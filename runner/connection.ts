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

export const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT)
}