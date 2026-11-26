import { createPipelineRun, enqueueOrDiscardRun, verifyPipelineRunReady } from '@/lib/actions/run-trigger';
import { graph, configFor } from '@/test/helpers/graph';
import { enqueuePipelineRun } from '@/lib/queue/runs';
import { prismaMock, resetPrismaMock, runTransactionsInline } from '@/test/mocks/prisma';

jest.mock('@/lib/prisma');

// bullmq constructs a Queue and opens an ioredis socket at module scope. This module only
// ever calls enqueuePipelineRun.
jest.mock('@/lib/queue/runs', () => ({ enqueuePipelineRun: jest.fn() }));

const enqueue = enqueuePipelineRun as jest.MockedFunction<typeof enqueuePipelineRun>;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => { });
  enqueue.mockResolvedValue(undefined);
  prismaMock.pipelineRun.delete.mockResolvedValue({} as never);
});

describe('stored pipeline execution settings', () => {
  it('maps stored configuration errors back to the stage name and variable row', async () => {
    const graphJson = graph('build deploy');
    graphJson.nodes[1].data.name = 'Deploy API';
    const configJson = configFor(graphJson.nodes, { deploy: {
      env_vars: [{ key: 'VALID', value: '' }, { key: 'API-KEY', value: 'private-value-must-not-appear' }],
    } });

    const result = await verifyPipelineRunReady({ graphJson, configJson }, null);

    expect(result.status).toBe('error');
    expect(result.message).toContain('Stage "Deploy API", environment variable 2 key:');
    expect(result.message).not.toContain('private-value-must-not-appear');
  });

  it('names the stored stage with an invalid timeout or retries', async () => {
    const graphJson = graph('build');
    graphJson.nodes[0].data.name = 'Build API';
    const configJson = configFor(graphJson.nodes, { build: { timeout: 0, retries: 11 } });
    const result = await verifyPipelineRunReady({ graphJson, configJson }, null);
    expect(result.message).toMatch(/Stage "Build API".*Timeout/);
    expect(result.message).toMatch(/Stage "Build API".*Retries/);
  });

  it('uses the stage number for malformed stored graph data', async () => {
    const graphJson = graph('build');
    graphJson.nodes[0].data.timeout = 0;
    graphJson.nodes[0].data.name = '';
    const result = await verifyPipelineRunReady({ graphJson, configJson: configFor(graphJson.nodes) }, null);
    expect(result.message).toMatch(/Stage 1.*Timeout/);
  });

  it('handles configuration errors whose stage is missing from the graph', async () => {
    const graphJson = graph('build');
    const configJson = configFor(graphJson.nodes);
    configJson.missing = { ...configJson.build, retries: 11 };
    const result = await verifyPipelineRunReady({ graphJson, configJson }, null);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/Stage configuration.*Retries/);
  });

  it.each([
    {}, { key: 'API_KEY' }, { key: '1KEY', value: 'value' },
    { key: 'API_KEY', value: 42 },
  ])('rejects malformed stored environment-variable rows (%j)', async row => {
    const graphJson = graph('build');
    const configJson = configFor(graphJson.nodes);
    const definition = { graphJson, configJson: { ...configJson, build: { ...configJson.build, env_vars: [row] } } };

    const result = await verifyPipelineRunReady(definition, null);

    expect(result.status).toBe('error');
  });

  it('rejects duplicate IDs in stored graphs before starting a run', async () => {
    const graphJson = graph('build build');
    const result = await verifyPipelineRunReady({ graphJson, configJson: configFor(graphJson.nodes) }, null);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/duplicate|unique/i);
  });

  it('accepts empty environment-variable values and distinct stage IDs', async () => {
    const graphJson = graph('build deploy');
    const configJson = configFor(graphJson.nodes, { build: { env_vars: [{ key: 'EMPTY', value: '' }] } });
    expect((await verifyPipelineRunReady({ graphJson, configJson }, null)).status).toBe('success');
  });

  it.each([
    ['timeout', 0], ['timeout', 43201], ['timeout', 1.5], ['timeout', '30'],
    ['retries', -1], ['retries', 11], ['retries', 0.5], ['retries', '2'],
  ])('rejects invalid stored %s=%s before a trigger can run', async (field, value) => {
    const graphJson = graph('build');
    const configJson = configFor(graphJson.nodes, { build: { [field]: value } });

    const result = await verifyPipelineRunReady({ graphJson, configJson }, null);

    expect(result.status).toBe('error');
    expect(result.message.toLowerCase()).toContain(field === 'timeout' ? 'timeout' : 'retries');
  });
});

describe('enqueueOrDiscardRun', () => {
  it('enqueues the run and keeps the row when the queue is reachable', async () => {
    expect(await enqueueOrDiscardRun('run-1')).toBe(true);

    expect(enqueue).toHaveBeenCalledWith('run-1');
    expect(prismaMock.pipelineRun.delete).not.toHaveBeenCalled();
  });

  /*
   * The window this exists for. The row is written before the enqueue — correctly, since a
   * job for a run that does not exist yet has nothing to load — so a queue that cannot be
   * reached leaves a run at QUEUED that no job will ever reference. RETRYABLE refuses to
   * re-run anything unfinished, so it cannot even be retried from its own page.
   */
  it('discards the run when the enqueue fails', async () => {
    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await enqueueOrDiscardRun('run-1')).toBe(false);
    expect(prismaMock.pipelineRun.delete).toHaveBeenCalledWith({ where: { id: 'run-1' } });
  });

  /*
   * Deleted rather than written FAILED, and the difference is visible: a run discarded this
   * way has no StageResult rows, and addNodeDetails gives a node with no row the status
   * 'pending'. A FAILED run with no rows would render as a failed run whose every stage
   * reads "Pending" — the defect fd7faee was written to fix, reintroduced by a different
   * door.
   */
  it('removes the row rather than marking it failed', async () => {
    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));

    await enqueueOrDiscardRun('run-1');

    expect(prismaMock.pipelineRun.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.pipelineRun.update).not.toHaveBeenCalled();
  });

  /*
   * A cleanup that fails leaves exactly the stranded row this is meant to prevent, but
   * throwing would replace the caller's message to the user with a crash — and the row is
   * not lost anyway: the sweeper returns a QUEUED run past its grace period and processRun
   * starts it from scratch once Redis is back.
   */
  it('reports the failure rather than throwing when the cleanup also fails', async () => {
    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));
    prismaMock.pipelineRun.delete.mockRejectedValue(new Error('connection terminated'));

    expect(await enqueueOrDiscardRun('run-1')).toBe(false);
  });
});

/*
 * Pipeline.lastRunId is what the pipelines list filters status through, so it has to name
 * the newest run. The real concurrency (the row lock, commits landing out of order) is
 * only provable against Postgres; these pin the statements that carry it.
 */
describe('the lastRun pointer', () => {
  it('re-points the pipeline at its newest remaining run after a discard', async () => {
    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));
    prismaMock.pipelineRun.delete.mockResolvedValue({ pipelineId: 'p1' } as never);
    prismaMock.pipelineRun.findFirst.mockResolvedValue({ id: 'run-0' } as never);

    await enqueueOrDiscardRun('run-1');

    expect(prismaMock.pipelineRun.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: { runNumber: 'desc' },
      where: { pipelineId: 'p1' },
    });
    // Only when the discarded run was the pointer — a newer trigger in between keeps its own.
    expect(prismaMock.pipeline.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', lastRunId: null },
      data: { lastRunId: 'run-0' },
    });
  });

  it('leaves the pipeline idle when the discarded run was its only one', async () => {
    enqueue.mockRejectedValue(new Error('ECONNREFUSED'));
    prismaMock.pipelineRun.delete.mockResolvedValue({ pipelineId: 'p1' } as never);
    prismaMock.pipelineRun.findFirst.mockResolvedValue(null);

    await enqueueOrDiscardRun('run-1');

    expect(prismaMock.pipeline.updateMany).not.toHaveBeenCalled();
  });

  it('advances the pointer to a new run only if it is newer than the current one', async () => {
    runTransactionsInline();
    prismaMock.pipelineRun.findFirst.mockResolvedValue({ runNumber: 4 } as never);
    prismaMock.pipelineRun.create.mockResolvedValue({ id: 'run-5', runNumber: 5, pipeline: { name: 'CI' } } as never);

    await createPipelineRun({
      pipelineId: 'p1', definitionId: 'd1', environmentId: null, trigger: 'manual', user: { id: 'u1', name: 'kyle' },
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(prismaMock.pipeline.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', OR: [{ lastRunId: null }, { lastRun: { runNumber: { lt: 5 } } }] },
      data: { lastRunId: 'run-5' },
    });
  });
});

/*
 * Deleting an environment nulls environmentId on every run that targeted it, so the name is
 * copied onto the row at creation — it is how retryRun tells a run whose environment was
 * deleted from one that never had an environment.
 */
describe('the environment snapshot', () => {
  const trigger = (environmentId: string | null) => createPipelineRun({
    pipelineId: 'p1', definitionId: 'd1', environmentId, trigger: 'manual', user: { id: 'u1', name: 'kyle' },
  });

  beforeEach(() => {
    runTransactionsInline();
    prismaMock.pipelineRun.findFirst.mockResolvedValue(null);
    prismaMock.pipelineRun.create.mockResolvedValue({ id: 'run-1', runNumber: 1, pipeline: { name: 'CI' } } as never);
  });

  // The type is copied with the name so a run against a deleted environment can still show what it was.
  it("records the targeted environment's name and type", async () => {
    prismaMock.environment.findUnique.mockResolvedValue({ name: 'prod', type: 'PRODUCTION' } as never);

    await trigger('env-1');

    expect(prismaMock.environment.findUnique).toHaveBeenCalledWith({ where: { id: 'env-1' }, select: { name: true, type: true } });
    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ environmentId: 'env-1', environmentName: 'prod', environmentType: 'PRODUCTION' }),
    }));
  });

  it('records no name or type for a run that targets no environment', async () => {
    await trigger(null);

    expect(prismaMock.environment.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ environmentId: null, environmentName: null, environmentType: null }),
    }));
  });
});

/*
 * The webhook route is the only caller that knows a commit: it reads payload.after (push) or
 * payload.pull_request.head.sha (pull_request) and the branch that was actually built. Manual
 * and retried runs have neither, so omitting them has to write null rather than leaving the
 * columns unset.
 */
describe('the commit snapshot', () => {
  beforeEach(() => {
    runTransactionsInline();
    prismaMock.pipelineRun.findFirst.mockResolvedValue(null);
    prismaMock.pipelineRun.create.mockResolvedValue({ id: 'run-1', runNumber: 1, pipeline: { name: 'CI' } } as never);
  });

  it('records the commit and branch when given', async () => {
    await createPipelineRun({
      pipelineId: 'p1', definitionId: 'd1', environmentId: null, trigger: 'webhook',
      user: { id: null, name: 'GitHub' }, commitSha: 'abc123', branch: 'main',
    });

    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ commitSha: 'abc123', branch: 'main' }),
    }));
  });

  it('records null for both when they are omitted', async () => {
    await createPipelineRun({
      pipelineId: 'p1', definitionId: 'd1', environmentId: null, trigger: 'manual',
      user: { id: 'u1', name: 'kyle' },
    });

    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ commitSha: null, branch: null }),
    }));
  });
});

/*
 * The repo URL is copied onto the run so a later edit to the pipeline cannot change a run
 * already in flight. Absent means "snapshot the pipeline's"; present, even null, is final.
 */
describe('the repo url snapshot', () => {
  const base = {
    pipelineId: 'p1', definitionId: 'd1', environmentId: null, trigger: 'manual',
    user: { id: 'u1', name: 'kyle' },
  } as const;

  beforeEach(() => {
    runTransactionsInline();
    prismaMock.pipelineRun.findFirst.mockResolvedValue(null);
    prismaMock.pipelineRun.create.mockResolvedValue({ id: 'run-1', runNumber: 1, pipeline: { name: 'CI' } } as never);
    prismaMock.$queryRaw.mockResolvedValue([{ repoUrl: 'https://github.com/o/r' }] as never);
  });

  it('snapshots the pipeline repo url when none is given', async () => {
    await createPipelineRun({ ...base });

    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ repoUrl: 'https://github.com/o/r' }),
    }));
  });

  it('uses an explicit repoUrl, including null, over the pipeline', async () => {
    await createPipelineRun({ ...base, repoUrl: null });

    expect(prismaMock.pipelineRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ repoUrl: null }),
    }));
  });
});
