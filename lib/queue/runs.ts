import { Queue } from 'bullmq';
import { queueConnection } from './connection';
import { RUN_QUEUE } from './names';
import { withTimeout } from './timeout';

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
export function runQueue(): Queue<RunJobData> {
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
 * Long enough that a slow round trip or a moment of reconnecting is not mistaken for an
 * outage, short enough that the person who pressed Run gets an answer rather than a page
 * that never finishes rendering.
 *
 * A timed-out 'runQueue().add()' is not a cancelled one. ioredis still holds the buffered command and will
 * flush it if Redis comes back, so the job can appear minutes later. That is harmless in
 * both directions: a trigger has by then discarded its run row, and processRun early-returns
 * on a run it cannot load, while an approval's late job simply advances the run the same way
 * the sweeper would have.
 */
const ENQUEUE_TIMEOUT_MS = 5_000;

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
  await withTimeout(
    runQueue().add(`run-${runId}`, { runId }, { jobId: `${runId}-${tag}` }),
    ENQUEUE_TIMEOUT_MS,
    `enqueue of run ${runId}`,
  );
}
