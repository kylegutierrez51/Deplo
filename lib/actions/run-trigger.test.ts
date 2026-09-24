import { createPipelineRun, enqueueOrDiscardRun } from '@/lib/actions/run-trigger';
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
