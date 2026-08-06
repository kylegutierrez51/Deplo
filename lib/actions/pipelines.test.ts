import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { savePipelineDefinition, addPipelineRun, deletePipeline, addPipeline, updatePipeline } from '@/lib/actions/pipelines';
import { toDefinition } from '@/lib/pipeline/definition';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { setSession, signedOut, sessionWithoutUserId } from '@/test/mocks/auth';
import type { CustomNode } from '@/lib/types';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
// A factory, not an automock: automocking still loads the real next/cache to
// introspect its shape, which pulls in Next's server runtime. Server actions
// only ever call revalidatePath.
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;


// `command` is widened to allow null so a case can model a stage the user never
// gave a command; toDefinition normalizes undefined and null to the same thing.
const node = (
  id: string,
  data: Partial<Omit<CustomNode['data'], 'command'>> & { command?: string | null } = {},
): CustomNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: 'custom', name: id, command: 'npm test', ...data } as CustomNode['data'],
});

/** Makes $transaction run its callback against the same deep mock. */
function runTransactionsInline() {
  prismaMock.$transaction.mockImplementation(
    (async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)) as never,
  );
}

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  setSession();
  runTransactionsInline();
  // The sweep runs on every successful save; default it to finding nothing.
  prismaMock.pipelineDefinition.findMany.mockResolvedValue([] as never);
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('savePipelineDefinition versioning', () => {
  it('starts a pipeline that has no definitions at version 0', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-1' } as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(result.status).toBe('success');
    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 0 }) }),
    );
  });

  it('increments from the latest version', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({
      id: 'def-9', version: 9, graphJson: { nodes: [], edges: [] }, configJson: {},
    } as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-10' } as never);

    await savePipelineDefinition('p1', [node('a')], []);

    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 10 }) }),
    );
  });

  // A save that changed nothing must reuse the current version, so `version`
  // counts distinct configurations rather than presses of the Save button.
  it('creates nothing when the content is unchanged', async () => {
    const nodes = [node('a')];
    const { graphJson, configJson } = toDefinition(nodes, []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({
      id: 'def-3', version: 3, graphJson, configJson,
    } as never);

    const result = await savePipelineDefinition('p1', nodes, []);

    expect(prismaMock.pipelineDefinition.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'success', definitionId: 'def-3' });
  });

  // Postgres jsonb reorders keys, so the stored copy never matches the fresh one
  // byte for byte. If the comparison were a plain JSON.stringify, every save
  // would mint a version.
  it('still detects "unchanged" when the stored keys come back reordered', async () => {
    const nodes = [node('a', { timeout: 30, retries: 1 })];
    const { graphJson, configJson } = toDefinition(nodes, []);

    const reordered = JSON.parse(JSON.stringify({
      configJson: { a: Object.fromEntries(Object.entries(configJson.a).reverse()) },
      graphJson: { edges: graphJson.edges, nodes: graphJson.nodes },
    }));

    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({
      id: 'def-3', version: 3, ...reordered,
    } as never);

    await savePipelineDefinition('p1', nodes, []);

    expect(prismaMock.pipelineDefinition.create).not.toHaveBeenCalled();
  });

  it('records the signed-in user as the author', async () => {
    setSession('user-42');
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-1' } as never);

    await savePipelineDefinition('p1', [node('a')], []);

    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: 'user-42' }) }),
    );
  });

  it('saves with a null author rather than failing when signed out', async () => {
    signedOut();
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-1' } as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(result.status).toBe('success');
    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: null }) }),
    );
  });

  it('revalidates both the list and the editor route', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-1' } as never);

    await savePipelineDefinition('p1', [node('a')], []);

    expect(revalidate).toHaveBeenCalledWith('/pipelines');
    expect(revalidate).toHaveBeenCalledWith('/pipelines/p1');
  });
});

describe('savePipelineDefinition error handling', () => {
  /*
   * The retry exists because two concurrent saves compute the same next version
   * and collide on [pipelineId, version]. The loser re-reads the latest version
   * and tries again, so losing the race is invisible to the user rather than an
   * error they have to act on. Confirmed against real Postgres in
   * lib/actions/pipelines.integration.test.ts.
   */
  it('retries a lost version race and succeeds', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create
      .mockRejectedValueOnce(prismaError('P2002') as never)
      .mockResolvedValueOnce({ id: 'def-2' } as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: 'success', message: 'Pipeline saved', definitionId: 'def-2' });
  });

  // The retry is bounded: a collision on every attempt gives up rather than
  // spinning, and reports the generic failure.
  it('gives up after SAVE_ATTEMPTS collisions', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockRejectedValue(prismaError('P2002') as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ status: 'error', message: 'Error saving pipeline. Please try again.' });
  });

  // A missing parent is not a race, so it reports rather than retrying.
  it.each(['P2003', 'P2025'])('reports a deleted pipeline for %s without retrying', async (code) => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockRejectedValue(prismaError(code) as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(result).toEqual({ status: 'error', message: 'This pipeline no longer exists.' });
    expect(prismaMock.pipelineDefinition.create).toHaveBeenCalledTimes(1);
  });

  it('reports a generic failure for an unrecognised error', async () => {
    prismaMock.pipelineDefinition.findFirst.mockRejectedValue(new Error('connection lost') as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(result).toEqual({ status: 'error', message: 'Error saving pipeline. Please try again.' });
  });

  // The sweep runs outside the transaction and swallows its own errors: a run
  // created mid-sweep makes the delete fail, and letting that roll back the
  // user's save would be the wrong trade.
  it('still succeeds when the stale-definition sweep fails', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-1' } as never);
    prismaMock.pipelineDefinition.findMany.mockRejectedValue(prismaError('P2003') as never);

    const result = await savePipelineDefinition('p1', [node('a')], []);

    expect(result.status).toBe('success');
  });

  it('deletes superseded definitions that no run references', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-new' } as never);
    prismaMock.pipelineDefinition.findMany.mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }] as never);

    await savePipelineDefinition('p1', [node('a')], []);

    expect(prismaMock.pipelineDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'def-new' }, runs: { none: {} } }),
      }),
    );
    expect(prismaMock.pipelineDefinition.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-1', 'old-2'] } },
    });
  });

  it('skips the delete entirely when nothing is stale', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);
    prismaMock.pipelineDefinition.create.mockResolvedValue({ id: 'def-1' } as never);

    await savePipelineDefinition('p1', [node('a')], []);

    expect(prismaMock.pipelineDefinition.deleteMany).not.toHaveBeenCalled();
  });
});

describe('addPipelineRun guards', () => {
  const nodes = [node('a')];
  const storedDefinition = (over: Record<string, unknown> = {}) => {
    const { graphJson, configJson } = toDefinition(nodes, []);
    return { id: 'def-1', version: 0, graphJson, configJson, ...over };
  };

  it('refuses without a target environment', async () => {
    const result = await addPipelineRun('p1', null, nodes, []);

    expect(result).toEqual({ status: 'error', message: 'Select an environment to target.' });
    expect(prismaMock.pipelineRun.create).not.toHaveBeenCalled();
  });

  // The only action that hard-fails on an anonymous caller, because a run has to
  // be attributable.
  it('refuses when signed out', async () => {
    signedOut();

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({ status: 'error', message: 'Sign in to run a pipeline.' });
  });

  it('refuses a session carrying no user id', async () => {
    sessionWithoutUserId();

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({ status: 'error', message: 'Sign in to run a pipeline.' });
  });

  it('refuses when the pipeline was never saved', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(null as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({ status: 'error', message: 'Save your current pipeline' });
  });

  // A run pins itself to a stored definition, so unsaved editor changes would
  // otherwise execute a graph that was never recorded.
  it('refuses when the editor has drifted from the stored definition', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(storedDefinition() as never);

    const result = await addPipelineRun('p1', 'env-1', [node('a'), node('b')], []);

    expect(result).toEqual({ status: 'error', message: 'Save or discard your current changes!' });
  });

  it('refuses when the environment has been deleted', async () => {
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue(storedDefinition() as never);
    prismaMock.environment.findUnique.mockResolvedValue(null as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({
      status: 'error', message: 'The selected environment no longer exists. Pick another.',
    });
  });

  it('refuses an empty pipeline', async () => {
    const { graphJson, configJson } = toDefinition([], []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({
      id: 'def-1', version: 0, graphJson, configJson,
    } as never);

    const result = await addPipelineRun('p1', 'env-1', [], []);

    expect(result).toEqual({
      status: 'error', message: 'This pipeline has no stages. Add at least one.',
    });
  });
});

describe('addPipelineRun graph validation', () => {
  const environment = (requireApproval: boolean) => ({
    id: 'env-1', name: 'prod', type: 'PRODUCTION', requireApproval,
    createdById: null, createdAt: new Date(), updatedAt: new Date(), secrets: [], createdBy: null,
  });

  it('creates the run when the graph is sound', async () => {
    const nodes = [node('a')];
    const { graphJson, configJson } = toDefinition(nodes, []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({ id: 'def-1', version: 0, graphJson, configJson } as never);
    prismaMock.environment.findUnique.mockResolvedValue(environment(false) as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({ status: 'success', message: 'Pipeline Run Triggered!' });
    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith({
      data: { pipelineId: 'p1', definitionId: 'def-1', trigger: 'MANUAL', triggeredById: 'user-1', environmentId: 'env-1' },
    });
  });

  // The graph rules are what make a run safe to execute, so this proves
  // validatePipelineGraph is actually wired in rather than merely exported.
  it('reports every graph problem in one message', async () => {
    const nodes = [node('a', { command: null }), node('d', { type: 'deploy', command: 'ship' })];
    const edges = [{ id: 'e0', source: 'a', target: 'd' }];
    const { graphJson, configJson } = toDefinition(nodes, edges);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({ id: 'def-1', version: 0, graphJson, configJson } as never);
    prismaMock.environment.findUnique.mockResolvedValue(environment(true) as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, edges);

    expect(result.status).toBe('error');
    expect(result.message).toContain('Cannot run pipeline:');
    expect(result.message).toMatch(/missing a command/);
    expect(result.message).toMatch(/Approval stage upstream/);
    expect(prismaMock.pipelineRun.create).not.toHaveBeenCalled();
  });

  // requireApproval is why the environment is fetched before the graph checks.
  it('allows an ungated deploy when the environment does not require approval', async () => {
    const nodes = [node('d', { type: 'deploy' })];
    const { graphJson, configJson } = toDefinition(nodes, []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({ id: 'def-1', version: 0, graphJson, configJson } as never);
    prismaMock.environment.findUnique.mockResolvedValue(environment(false) as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result.status).toBe('success');
  });

  // Everything the action checked up front can still be deleted between the
  // checks and the insert, which is what this branch is for.
  it.each(['P2003', 'P2025'])('reports a deleted pipeline or environment for %s at insert time', async (code) => {
    const nodes = [node('a')];
    const { graphJson, configJson } = toDefinition(nodes, []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({ id: 'def-1', version: 0, graphJson, configJson } as never);
    prismaMock.environment.findUnique.mockResolvedValue(environment(false) as never);
    prismaMock.pipelineRun.create.mockRejectedValue(prismaError(code) as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({
      status: 'error', message: 'This pipeline or environment no longer exists.',
    });
  });

  it('falls back to the generic message for an unrecognised error', async () => {
    const nodes = [node('a')];
    const { graphJson, configJson } = toDefinition(nodes, []);
    prismaMock.pipelineDefinition.findFirst.mockResolvedValue({ id: 'def-1', version: 0, graphJson, configJson } as never);
    prismaMock.environment.findUnique.mockResolvedValue(environment(false) as never);
    prismaMock.pipelineRun.create.mockRejectedValue(new Error('connection lost') as never);

    const result = await addPipelineRun('p1', 'env-1', nodes, []);

    expect(result).toEqual({
      status: 'error', message: 'Error triggering pipeline. Please try again.',
    });
  });
});

describe('addPipeline', () => {
  const form = (over: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set('name', 'CI');
    fd.set('repo_url', 'https://github.com/o/r');
    fd.set('description', 'desc');
    Object.entries(over).forEach(([k, v]) => fd.set(k, v));
    fd.append('branch_filters', 'main');
    return fd;
  };

  const idle = { status: 'idle' as const, message: '' };

  // A pipeline is created with an empty version 0 so the editor always has a
  // definition to load rather than special-casing "never saved".
  it('seeds an empty version 0 definition alongside the pipeline', async () => {
    await addPipeline(idle, form());

    expect(prismaMock.pipeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          definitions: { create: expect.objectContaining({ version: 0, graphJson: { nodes: [], edges: [] }, configJson: {} }) },
        }),
      }),
    );
  });

  it('collects every branch filter, not just the first', async () => {
    const fd = form();
    fd.append('branch_filters', 'develop');

    await addPipeline(idle, fd);

    expect(prismaMock.pipeline.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchFilters: ['main', 'develop'] }) }),
    );
  });

  it('reports a friendly message when the insert fails', async () => {
    prismaMock.pipeline.create.mockRejectedValue(prismaError('P2002') as never);

    const result = await addPipeline(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error adding pipeline. Please try again.' });
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe('deletePipeline', () => {
  it('revalidates the list on success', async () => {
    prismaMock.pipeline.delete.mockResolvedValue({ id: 'p1' } as never);

    const result = await deletePipeline('p1');

    expect(result.status).toBe('success');
    expect(revalidate).toHaveBeenCalledWith('/pipelines');
  });

  it('reports the row being already gone rather than a generic failure', async () => {
    prismaMock.pipeline.delete.mockRejectedValue(prismaError('P2025') as never);

    const result = await deletePipeline('p1');

    expect(result).toEqual({ status: 'error', message: 'This pipeline no longer exists.' });
  });

  it('returns the generic message for an unrecognised error', async () => {
    prismaMock.pipeline.delete.mockRejectedValue(new Error('network') as never);

    const result = await deletePipeline('p1');

    expect(result).toEqual({ status: 'error', message: 'Error deleting pipeline. Please try again.' });
  });
});

describe('updatePipeline', () => {
  const form = (over: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set('id', 'p1');
    fd.set('name', 'CI');
    fd.set('repo_url', 'https://github.com/o/r');
    fd.set('description', 'desc');
    Object.entries(over).forEach(([k, v]) => fd.set(k, v));
    fd.append('branch_filters', 'main');
    return fd;
  };

  const idle = { status: 'idle' as const, message: '' };

  it('updates by id and revalidates', async () => {
    const result = await updatePipeline(idle, form({ name: 'Renamed' }));

    expect(prismaMock.pipeline.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { name: 'Renamed', repoUrl: 'https://github.com/o/r', description: 'desc', branchFilters: ['main'] },
    });
    expect(result).toEqual({ status: 'success', message: 'Pipeline updated' });
    expect(revalidate).toHaveBeenCalledWith('/pipelines');
  });

  it('reports a pipeline deleted from under the edit', async () => {
    prismaMock.pipeline.update.mockRejectedValue(prismaError('P2025') as never);

    const result = await updatePipeline(idle, form());

    expect(result).toEqual({ status: 'error', message: 'This pipeline no longer exists.' });
  });

  // The raw Prisma message names tables and columns, so it belongs in the log
  // rather than in the browser.
  it('does not put the underlying error message in front of the user', async () => {
    prismaMock.pipeline.update.mockRejectedValue(new Error('relation "pipelines" does not exist') as never);

    const result = await updatePipeline(idle, form());

    expect(result).toEqual({ status: 'error', message: 'Error updating pipeline. Please try again.' });
  });
});
