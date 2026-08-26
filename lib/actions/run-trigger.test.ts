import { enqueueOrDiscardRun } from '@/lib/actions/run-trigger';
import { enqueuePipelineRun } from '@/lib/queue/runs';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';

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
