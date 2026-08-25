/*
==============================================================================================
 * Bounds a queue operation that would otherwise never settle.
 * 
 * Used with `enqueuePipelineRun()` in @/lib/queue/runs.ts to catch whether 
 * a run get queued or not depending on a set timeout.
 * Also used with `runQueue().getWorkersCount()` in health.ts to determine whether the 
 * 1 runWorker defined in index.ts has a connection to Redis.
 *
 * A Redis command is not a request that fails when Redis is down. In @/lib/queue/connection.ts, 
 * queueConnection() sets 'maxRetriesPerRequest: null' explicitly, and with it set, 
 * ioredis buffers commands issued while disconnected and retries the connection 
 * forever, so `queue.add()` against a dead Redis returns a promise that is neither resolved nor 
 * rejected ever, meaning `queue.add()` needs 'withTimeout()' to stop the caller of enqueuePipelineRun()
 * from waiting on it.
 * 
 * Without this function, Nextjs would have to await `runQueue().add()` from a server action via
 * addPipelineRun() and retryRun(), which hangs the action and a component render (in run detail page)
 *
 * Deliberately not solved with BullMQ's 'enableOfflineQueue' config option:
 * it's false on the connection, which makes ioredis reject immediately instead of buffering. 
 * The Queue is constructed lazily on first use, so the very first enqueue after a server start 
 * would be issued while the connection is still handshaking and would reject 
 * falsely — trading a hang that happens when Redis is down for a failure that happens 
 * when it is fine.
==============================================================================================
*/
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);

    timer.unref?.();

    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}
