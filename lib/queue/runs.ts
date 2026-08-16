import { Queue } from 'bullmq';
import { queueConnection } from './connection';
import { RUN_QUEUE } from './names';

/*
==============================================================================================
 * A run job carries the run id and nothing else — every other fact about the run is a
 * query away, and the row is the truth while a payload is only a snapshot of it.
==============================================================================================
 */
export type RunJobData = { runId: string };

const globalForQueue = global as unknown as {
  runQueue?: Queue<RunJobData>;
};

/*
==============================================================================================
 * The same globalThis memo as lib/prisma.ts:4-14, for the same reason: Next re-evaluates
 * modules on every dev edit, and a fresh `new Queue(...)` per edit leaks an ioredis
 * connection until the process runs out of sockets.
 *
 * Unlike lib/prisma.ts this is not gated on NODE_ENV. The gate there only keeps a global
 * out of production; here the module is evaluated once in production anyway, so the
 * global is written once and behaves exactly like a module-scope const — and skipping
 * the gate keeps the lazy path a single expression.
 *
 * Lazy because queueConnection() throws on missing env and must not run at import time.
==============================================================================================
 */
function runQueue(): Queue<RunJobData> {
  globalForQueue.runQueue ??= new Queue<RunJobData>(RUN_QUEUE, {
    connection: queueConnection(),
    defaultJobOptions: {
      // A run job failing means processRun threw — the database was unreachable, or
      // Redis blipped. Those are worth retrying, unlike a stage's non-zero exit, which
      // is a recorded outcome rather than a job failure. Stage jobs get attempts: 1.
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },

      // Completed jobs are kept by default, forever. The payload is only a run id so
      // there is nothing sensitive in it, but unbounded growth is still a Redis leak.
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86_400 },
    },
  });

  return globalForQueue.runQueue;
}

/*
==============================================================================================
 * Tells the runner there is progress to make on a run. Called once by addPipelineRun
 * when the row is created, and again by each approval decision once those land.
 *
 * `tag` must identify the *event*, not the kind of event. It is part of the jobId, and
 * BullMQ silently returns the existing job rather than enqueuing when a jobId is already
 * in the keyspace — which is what makes a retried enqueue harmless, but also means two
 * approvals on the same run sharing the tag 'approval' would drop the second one. Pass
 * something like `approval-${stageId}`.
==============================================================================================
*/
export async function enqueuePipelineRun(runId: string, tag = 'trigger'): Promise<void> {
  await runQueue().add(`run-${runId}`, { runId }, { jobId: `${runId}-${tag}` });
}
