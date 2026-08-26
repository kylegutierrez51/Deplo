import { Queue } from 'bullmq';

/*
 * bullmq is mocked outright: constructing a real Queue opens an ioredis socket, and the
 * point here is what enqueuePipelineRun does with the add, not what BullMQ does with it.
 *
 * The queue instance is memoized on globalThis — see the note in runs.ts — so it outlives
 * module resets and has to be cleared by hand between cases.
 */
jest.mock('bullmq', () => ({ Queue: jest.fn() }));

const QueueMock = Queue as unknown as jest.Mock;

const add = jest.fn<Promise<unknown>, unknown[]>();

beforeEach(() => {
  jest.clearAllMocks();
  delete (global as { runQueue?: unknown }).runQueue;

  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';

  add.mockResolvedValue({});
  QueueMock.mockImplementation(() => ({ add }));
});

describe('enqueuePipelineRun', () => {
  it('adds a job carrying the run id and nothing else', async () => {
    const { enqueuePipelineRun } = await import('./runs');

    await enqueuePipelineRun('run-1');

    expect(add).toHaveBeenCalledWith('run-run-1', { runId: 'run-1' }, { jobId: 'run-1-trigger' });
  });

  // The tag identifies the event, not the kind of event: it is part of the jobId, and BullMQ
  // answers an add on a known id by handing back the existing job and enqueuing nothing.
  it('puts the tag in the jobId so two events on one run do not collide', async () => {
    const { enqueuePipelineRun } = await import('./runs');

    await enqueuePipelineRun('run-1', 'approval-gate-b');

    expect(add).toHaveBeenCalledWith(
      'run-run-1', { runId: 'run-1' }, { jobId: 'run-1-approval-gate-b' },
    );
  });

  /*
   * The behaviour this function exists to guarantee, and the one that is invisible until
   * Redis is actually down: `add` against a dead Redis neither resolves nor rejects, because
   * ioredis buffers the command and retries the connection forever. Unbounded, the server
   * action that awaits this never returns and the page renders forever with no error — which
   * is exactly what it did before the timeout was added.
   *
   * Delete the withTimeout wrapper and every other test in this file still passes.
   */
  it('rejects rather than hanging when the queue never answers', async () => {
    jest.useFakeTimers();

    try {
      add.mockReturnValue(new Promise(() => { }));

      const { enqueuePipelineRun } = await import('./runs');

      const pending = enqueuePipelineRun('run-1');
      const assertion = expect(pending).rejects.toThrow(/timed out/);

      await jest.advanceTimersByTimeAsync(5_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  // The memo is what stops a fresh ioredis connection leaking on every dev-server edit.
  it('constructs the queue once and reuses it', async () => {
    const { enqueuePipelineRun } = await import('./runs');

    await enqueuePipelineRun('run-1');
    await enqueuePipelineRun('run-2');

    expect(QueueMock).toHaveBeenCalledTimes(1);
  });

  /*
   * queueConnection() throws on a missing REDIS_HOST rather than handing ioredis a nonsense
   * address, and that throw has to reach the caller: addPipelineRun turns it into a message,
   * and swallowing it here would leave a run at QUEUED with nothing to explain why.
   */
  it('surfaces a missing REDIS_HOST rather than enqueuing into nowhere', async () => {
    delete process.env.REDIS_HOST;

    const { enqueuePipelineRun } = await import('./runs');

    await expect(enqueuePipelineRun('run-1')).rejects.toThrow('REDIS_HOST is not set');
    expect(add).not.toHaveBeenCalled();
  });

  /*
   * The regression this pins: BullMQ only defaults maxRetriesPerRequest to null on the
   * blocking connection a Worker opens for itself, never on a plain Queue like this one. Left
   * at ioredis's real default of 20, a command issued while Redis is down eventually gives up
   * and rejects instead of staying pending — which withTimeout's race would still catch here,
   * but only by finishing first, not because the promise actually never settles the way every
   * comment in this file says it does. queueConnection() sets it explicitly so that claim is
   * true rather than incidentally true.
   */
  it('constructs the queue with maxRetriesPerRequest disabled', async () => {
    const { enqueuePipelineRun } = await import('./runs');

    await enqueuePipelineRun('run-1');

    expect(QueueMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      connection: expect.objectContaining({ maxRetriesPerRequest: null }),
    }));
  });
});
