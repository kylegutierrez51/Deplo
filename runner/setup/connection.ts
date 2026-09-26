// Assumes runner/env.ts has already run — it is the first import of the entrypoint.
// Importing this module without that ordering throws even when .env is populated.

const REDIS_HOST = process.env.REDIS_HOST?.trim() || (() => {
  throw new Error("REDIS_HOST is not set");
})();

const REDIS_PORT = process.env.REDIS_PORT?.trim() || (() => {
  throw new Error("REDIS_PORT is not set");
})();

export const RUNNER_WORKSPACE_ROOT = process.env.RUNNER_WORKSPACE_ROOT?.trim() || (() => {
  throw new Error("RUNNER_WORKSPACE_ROOT not set");
})();


/* 
 * maxRetriesPerRequest: null -- ensures every 'stageWorker().add()' call (in 'await enqueueStageJob()') 
 * goes through whenever Redis returns from a shutdown, regardless of how long it has been.
 * 
 * Without it, whenever Redis is down and a stage changes from 'PENDING' to 'QUEUED' and
 * attempts to get added via 'stageWorker.add()', in around ~4 minutes ioredis will reject
 * it with 'MaxRetriesPerRequestError' and will never run that stage unless the runner restarts 
 * so that the reaper can advance/fail it.
 */
export const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  maxRetriesPerRequest: null,
}