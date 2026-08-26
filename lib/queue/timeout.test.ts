import { withTimeout } from './timeout';

/*
 * The helper exists because a Redis command against a dead Redis is not a request that
 * fails — queueConnection() sets maxRetriesPerRequest: null explicitly (BullMQ does not
 * default to that for a plain Queue), so ioredis buffers the command and retries the
 * connection forever, and the promise never settles in either direction. Every await on
 * the queue from the web app goes through this, which makes its three behaviours load-bearing:
 * pass a value through, pass a real failure through, and turn "never" into a rejection.
 */

describe('withTimeout', () => {
  it('resolves with the value when the operation finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1_000, 'op')).resolves.toBe('done');
  });

  // A real failure has to arrive as itself. Replacing it with the timeout message would
  // report "the queue is unreachable" for a queue that answered and said no.
  it('passes a genuine rejection through unchanged', async () => {
    await expect(withTimeout(Promise.reject(new Error('WRONGTYPE')), 1_000, 'op'))
      .rejects.toThrow('WRONGTYPE');
  });

  it('rejects with a labelled timeout when the operation never settles', async () => {
    jest.useFakeTimers();

    try {
      const pending = withTimeout(new Promise<never>(() => { }), 5_000, 'enqueue of run r1');
      const assertion = expect(pending).rejects.toThrow('enqueue of run r1 timed out after 5000ms');

      await jest.advanceTimersByTimeAsync(5_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  /*
   * The losing promise settles on its own schedule long after nobody is listening. Without
   * the catch attached inside the helper, a rejection arriving then has no handler and Node
   * treats it as an unhandled rejection — which, in the server process this runs in, is a
   * crash rather than a log line.
   */
  it('swallows a rejection that arrives after the timeout has already lost it', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    try {
      const slow = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('connection torn down')), 20);
      });

      await expect(withTimeout(slow, 5, 'op')).rejects.toThrow('timed out');

      // Past the point the loser rejects, plus enough turns for Node to have noticed.
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  // The timer is cleared on the winning path, so a resolved operation cannot be followed by
  // a stray rejection — and nothing holds the event loop open behind it.
  it('does not fire the timeout after the operation has already resolved', async () => {
    jest.useFakeTimers();

    try {
      const settled = jest.fn();
      const raced = withTimeout(Promise.resolve('done'), 1_000, 'op').then(settled, settled);

      await jest.advanceTimersByTimeAsync(5_000);
      await raced;

      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled).toHaveBeenCalledWith('done');
    } finally {
      jest.useRealTimers();
    }
  });
});
