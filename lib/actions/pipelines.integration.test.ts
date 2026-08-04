import prisma from '@/lib/prisma';
import { savePipelineDefinition } from '@/lib/actions/pipelines';
import { makePipeline, makeUser, makeDefinition, makeRun, stage } from '@/test/integration/factories';

jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));

/*
 * Runs against real Postgres. These are the cases a mocked Prisma cannot prove,
 * because what is under test is the database's own behaviour: the composite
 * unique constraint, the ON DELETE RESTRICT on runs, and the interaction between
 * them and the retry loop.
 */

const versionsOf = (pipelineId: string) =>
  prisma.pipelineDefinition.findMany({
    where: { pipelineId }, orderBy: { version: 'asc' }, select: { version: true },
  }).then(rows => rows.map(r => r.version));

describe('version allocation', () => {
  it('numbers the first definition 0', async () => {
    const pipeline = await makePipeline();

    await savePipelineDefinition(pipeline.id, [stage('a')], []);

    expect(await versionsOf(pipeline.id)).toEqual([0]);
  });

  it('increments on a real edit', async () => {
    const pipeline = await makePipeline();

    await savePipelineDefinition(pipeline.id, [stage('a')], []);
    await savePipelineDefinition(pipeline.id, [stage('a'), stage('b')], []);

    const rows = await prisma.pipelineDefinition.findMany({
      where: { pipelineId: pipeline.id }, orderBy: { version: 'asc' },
    });
    expect(rows.at(-1)?.version).toBe(1);
  });

  // The no-op check has to survive a Postgres round trip: jsonb reorders keys,
  // so a naive comparison would mint a version on every save.
  it('mints nothing when the graph is saved again unchanged', async () => {
    const pipeline = await makePipeline();
    const nodes = [stage('a', { timeout: 30, retries: 2, secrets: { e1: ['s2', 's1'] } })];

    const first = await savePipelineDefinition(pipeline.id, nodes, []);
    const second = await savePipelineDefinition(pipeline.id, nodes, []);

    expect(second.definitionId).toBe(first.definitionId);
    expect(await prisma.pipelineDefinition.count({ where: { pipelineId: pipeline.id } })).toBe(1);
  });

  // Versions are "the nth edit ever made", not a row count — the sweep leaves
  // gaps behind.
  it('leaves version numbers sparse after the sweep', async () => {
    const user = await makeUser();
    const pipeline = await makePipeline();

    // v0, kept alive by a run that references it.
    const v0 = await savePipelineDefinition(pipeline.id, [stage('a')], []);
    await makeRun(pipeline.id, v0.definitionId!, user.id);

    // v1 and v2 are unreferenced, so saving v3 sweeps them away.
    await savePipelineDefinition(pipeline.id, [stage('a'), stage('b')], []);
    await savePipelineDefinition(pipeline.id, [stage('a'), stage('b'), stage('c')], []);
    await savePipelineDefinition(pipeline.id, [stage('a'), stage('b'), stage('c'), stage('d')], []);

    expect(await versionsOf(pipeline.id)).toEqual([0, 3]);
  });
});

describe('the unique constraint the retry loop exists for', () => {
  it('rejects a duplicate [pipelineId, version] at the database level', async () => {
    const pipeline = await makePipeline();
    await makeDefinition(pipeline.id, 0, [stage('a')]);

    await expect(makeDefinition(pipeline.id, 0, [stage('b')]))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  // The real race: several saves read the same latest version and compute the
  // same next one. Only one insert can win each number, and the retry loop is
  // what turns the losers into successes rather than errors.
  it('resolves concurrent saves of different content without losing one', async () => {
    const pipeline = await makePipeline();
    await savePipelineDefinition(pipeline.id, [stage('seed')], []);

    const results = await Promise.all([
      savePipelineDefinition(pipeline.id, [stage('seed'), stage('a')], []),
      savePipelineDefinition(pipeline.id, [stage('seed'), stage('b')], []),
      savePipelineDefinition(pipeline.id, [stage('seed'), stage('c')], []),
    ]);

    const succeeded = results.filter(r => r.status === 'success');

    // Every caller that succeeded must have got a distinct row, and no version
    // may be reused.
    const versions = await versionsOf(pipeline.id);
    expect(new Set(versions).size).toBe(versions.length);
    expect(succeeded.length).toBeGreaterThan(0);
    expect(new Set(succeeded.map(r => r.definitionId)).size).toBe(succeeded.length);
  });

  it('keeps versions unique per pipeline, not globally', async () => {
    const first = await makePipeline();
    const second = await makePipeline();

    await savePipelineDefinition(first.id, [stage('a')], []);
    await savePipelineDefinition(second.id, [stage('a')], []);

    expect(await versionsOf(first.id)).toEqual([0]);
    expect(await versionsOf(second.id)).toEqual([0]);
  });
});

describe('the sweep and ON DELETE RESTRICT', () => {
  // This is the constraint that makes the Run Detail page truthful: a run must
  // always be able to resolve the exact graph it executed.
  it('refuses to delete a definition a run points at', async () => {
    const user = await makeUser();
    const pipeline = await makePipeline();
    const definition = await makeDefinition(pipeline.id, 0, [stage('a')]);
    await makeRun(pipeline.id, definition.id, user.id);

    await expect(prisma.pipelineDefinition.delete({ where: { id: definition.id } }))
      .rejects.toMatchObject({ code: 'P2003' });
  });

  it('sweeps away an unreferenced superseded definition', async () => {
    const pipeline = await makePipeline();

    await savePipelineDefinition(pipeline.id, [stage('a')], []);
    await savePipelineDefinition(pipeline.id, [stage('a'), stage('b')], []);

    expect(await prisma.pipelineDefinition.count({ where: { pipelineId: pipeline.id } })).toBe(1);
  });

  it('keeps a superseded definition that a run still references', async () => {
    const user = await makeUser();
    const pipeline = await makePipeline();

    const first = await savePipelineDefinition(pipeline.id, [stage('a')], []);
    await makeRun(pipeline.id, first.definitionId!, user.id);
    await savePipelineDefinition(pipeline.id, [stage('a'), stage('b')], []);

    expect(await prisma.pipelineDefinition.count({ where: { pipelineId: pipeline.id } })).toBe(2);
  });

  // The save must still succeed even though the sweep could not complete —
  // rolling the user's work back over a housekeeping failure would be worse.
  it('reports success even when nothing could be swept', async () => {
    const user = await makeUser();
    const pipeline = await makePipeline();

    const first = await savePipelineDefinition(pipeline.id, [stage('a')], []);
    await makeRun(pipeline.id, first.definitionId!, user.id);

    const second = await savePipelineDefinition(pipeline.id, [stage('a'), stage('b')], []);

    expect(second.status).toBe('success');
  });
});

describe('cascades', () => {
  it('removes a pipeline\'s definitions when the pipeline goes', async () => {
    const pipeline = await makePipeline();
    await makeDefinition(pipeline.id, 0, [stage('a')]);

    await prisma.pipeline.delete({ where: { id: pipeline.id } });

    expect(await prisma.pipelineDefinition.count()).toBe(0);
  });

  // createdById is SetNull, so deleting a user must orphan their work rather
  // than destroy it.
  it('orphans a definition rather than deleting it with its author', async () => {
    const user = await makeUser();
    const pipeline = await makePipeline({ createdById: user.id });

    await prisma.user.delete({ where: { id: user.id } });

    const survivor = await prisma.pipeline.findUnique({ where: { id: pipeline.id } });
    expect(survivor?.createdById).toBeNull();
  });
});
