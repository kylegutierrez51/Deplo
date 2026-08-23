import prisma from '@/lib/prisma';
import { openRetry, cancelPendingAwaitingQueuedStages } from './db';
import { Prisma, type StageStatus } from '@/generated/prisma/client';
import { makeUser, makePipeline, makeDefinition, makeRun } from '@/test/integration/factories';

/*
 * The parts of db.ts that only a real database can answer for.
 *
 * openRetry's guards are the reason this file exists. Everywhere else in db.ts the guard is
 * a status on the row being written, which runner/db.test.ts pins by asserting the where
 * clause it hands Prisma. Two of openRetry's are not that:
 *
 *   - `run: { status: 'RUNNING' }` on the findFirst is a filter across a *relation*. Against
 *     the mock it is an object literal that is never executed, so a wrong relation name or a
 *     status outside the enum passes the unit tier and fails at runtime.
 *   - `where: { id, status: 'RUNNING' }` on pipelineRun.update is an extended unique filter.
 *     The mock resolves whatever it is told to and never applies it, so the unit tier cannot
 *     tell a guard that filters from one Prisma quietly ignores — and if it were ignored,
 *     the retry would be written onto a finalized run exactly as it was before the fix.
 *
 * The same is true of cancelPendingAwaitingQueuedStages' status list: adding QUEUED to it is a
 * one-word change that the mock cannot distinguish from a typo.
 */

async function makeRunningRun() {
  const user = await makeUser();
  const pipeline = await makePipeline({ createdById: user.id });
  const definition = await makeDefinition(pipeline.id, 1);
  const run = await makeRun(pipeline.id, definition.id, user.id);

  await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'RUNNING' } });

  return run;
}

function makeStageRow(
  runId: string,
  over: Partial<{ stageId: string, attempt: number, maxRetries: number, status: StageStatus }> = {},
) {
  return prisma.stageResult.create({
    data: {
      runId,
      stageId: over.stageId ?? 'unit-tests',
      stageName: 'unit tests',
      stageType: 'CUSTOM',
      command: 'npm test',
      status: over.status ?? 'RUNNING',
      attempt: over.attempt ?? 1,
      maxRetries: over.maxRetries ?? 4,
    },
  });
}

const rowsFor = (runId: string, stageId: string) =>
  prisma.stageResult.findMany({ where: { runId, stageId }, orderBy: { attempt: 'asc' } });

describe('openRetry against a real database', () => {
  it('opens the next attempt while the run is still RUNNING', async () => {
    const run = await makeRunningRun();
    await makeStageRow(run.id, { attempt: 1 });

    expect(await openRetry(run.id, 'unit-tests', 1)).toBe(true);

    const rows = await rowsFor(run.id, 'unit-tests');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(expect.objectContaining({
      runId: run.id, stageId: 'unit-tests', attempt: 2, status: 'PENDING',
      stageName: 'unit tests', command: 'npm test', maxRetries: 4,
    }));
  });

  /*
   * The bug this guard was added for, reproduced with rows rather than timing.
   *
   * Two sibling stages fail a second apart. The first opens attempt 4 and the run carries
   * on; the second exhausts its own budget and finalizes the run FAILED. When attempt 4
   * then fails, nothing about *this* stage says the run is over — its own row is still
   * RUNNING and its budget still has room — so the only thing standing between it and a
   * PENDING attempt 5 that advanceRun will never dispatch is the run's status.
   */
  it('opens nothing once a sibling has finalized the run FAILED', async () => {
    const run = await makeRunningRun();
    await makeStageRow(run.id, { attempt: 4, maxRetries: 4 });
    await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'FAILED' } });

    expect(await openRetry(run.id, 'unit-tests', 4)).toBe(false);
    expect(await rowsFor(run.id, 'unit-tests')).toHaveLength(1);
  });

  // The same guard from the other direction: a stage whose command failed in the instant
  // the run was cancelled is retryable as far as stageProcessor is concerned, and used to
  // get a fresh PENDING row on a run nothing would ever advance again.
  it('opens nothing on a cancelled run', async () => {
    const run = await makeRunningRun();
    await makeStageRow(run.id, { attempt: 1 });
    await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'CANCELLED' } });

    expect(await openRetry(run.id, 'unit-tests', 1)).toBe(false);
    expect(await rowsFor(run.id, 'unit-tests')).toHaveLength(1);
  });

  // The stage-level guard, which the unit tier pins as a where clause and this proves
  // actually selects: an attempt already resolved by someone else is not this caller's to
  // hand another go.
  it('opens nothing for an attempt this caller no longer owns', async () => {
    const run = await makeRunningRun();
    await makeStageRow(run.id, { attempt: 1, status: 'FAILED' });

    expect(await openRetry(run.id, 'unit-tests', 1)).toBe(false);
    expect(await rowsFor(run.id, 'unit-tests')).toHaveLength(1);
  });

  /*
   * @@unique([runId, stageId, attempt]) is what makes the insert a compare-and-swap, and
   * P2002 the lost-race signal. Worth proving here rather than only against a thrown mock,
   * since the constraint has to exist in the migration for any of it to hold.
   */
  it('reports a lost race when the next attempt already exists', async () => {
    const run = await makeRunningRun();
    await makeStageRow(run.id, { attempt: 1 });
    await makeStageRow(run.id, { attempt: 2, status: 'PENDING' });

    expect(await openRetry(run.id, 'unit-tests', 1)).toBe(false);
    expect(await rowsFor(run.id, 'unit-tests')).toHaveLength(2);
  });

  /*
   * The assumption the whole guard rests on: an extended unique filter on `update` really
   * filters, and says so with P2025 rather than updating anyway.
   *
   * openRetry cannot reach this path from the outside — its own findFirst rejects a
   * finalized run first — so the race it exists to lose is not reproducible through the
   * public function without interleaving the two statements. This pins the primitive
   * instead: if Prisma ever stopped applying the extra filter, the guard would be dead
   * code and every other test in this file would still pass.
   */
  it('rejects a run-scoped write once the run is no longer RUNNING', async () => {
    const run = await makeRunningRun();
    await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'FAILED' } });

    const write = prisma.pipelineRun.update({
      where: { id: run.id, status: 'RUNNING' },
      data: { finishedAt: new Date() },
    });

    const error = await write.then(() => null, (thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2025');
  });
});

describe('cancelPendingAwaitingQueuedStages against a real database', () => {
  /*
   * QUEUED is the member added when the retry-outliving-its-run bug was fixed, and the
   * reason it belongs: advanceRun claims a retry row to QUEUED and enqueues it while the
   * run is still RUNNING, so by the time a sibling finalizes the run the row is past
   * PENDING. Sweeping it is what turns the job already sitting in Redis into a no-op,
   * since markStageRunning guards on QUEUED and loses.
   *
   * RUNNING stays out: that row has a process behind it and only the worker that owns it
   * can write its real outcome.
   */
  it('cancels the unstarted rows of a run and leaves the running one alone', async () => {
    const run = await makeRunningRun();
    await makeStageRow(run.id, { stageId: 'pending', status: 'PENDING' });
    await makeStageRow(run.id, { stageId: 'queued', status: 'QUEUED' });
    await makeStageRow(run.id, { stageId: 'awaiting', status: 'AWAITING_APPROVAL' });
    await makeStageRow(run.id, { stageId: 'running', status: 'RUNNING' });
    await makeStageRow(run.id, { stageId: 'succeeded', status: 'SUCCEEDED' });

    expect(await cancelPendingAwaitingQueuedStages(run.id)).toBe(3);

    const byStage = new Map(
      (await prisma.stageResult.findMany({ where: { runId: run.id } }))
        .map(row => [row.stageId, row.status]),
    );

    expect(byStage.get('pending')).toBe('CANCELLED');
    expect(byStage.get('queued')).toBe('CANCELLED');
    expect(byStage.get('awaiting')).toBe('CANCELLED');
    expect(byStage.get('running')).toBe('RUNNING');
    expect(byStage.get('succeeded')).toBe('SUCCEEDED');
  });

  // Scoped by runId, not by status alone — a concurrent run's rows are not this run's to
  // close out.
  it('leaves the stages of other runs untouched', async () => {
    const mine = await makeRunningRun();
    const theirs = await makeRunningRun();
    await makeStageRow(mine.id, { stageId: 'a', status: 'QUEUED' });
    await makeStageRow(theirs.id, { stageId: 'a', status: 'QUEUED' });

    expect(await cancelPendingAwaitingQueuedStages(mine.id)).toBe(1);

    const [other] = await rowsFor(theirs.id, 'a');
    expect(other.status).toBe('QUEUED');
  });
});
