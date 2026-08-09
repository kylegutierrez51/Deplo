import type { ConnectionOptions } from 'bullmq';

/*
==============================================================================================
 * Where Redis is. The web app and the runner are two separate processes that both talk
 * to it, so both have to look its address up; this is the web app's copy of that lookup.
 *
 * The runner's own runner/connection.ts cannot be reused here. The dependency only runs
 * one way — runner/ imports from lib/, never the reverse — and that file also demands
 * RUNNER_WORKSPACE_ROOT, which the web server has no business knowing about.
 *
 * Made as a function rather than a module-scope constant:
 * constants are read the instant anything imports the file, and `next build` imports
 * everything whether or not it is ever used. Reading — let alone throwing on — REDIS_HOST
 * at module scope would therefore fail the build outright on any machine with no Redis
 * configured, including CI, which builds the app for the E2E suite and never starts the
 * runner. As a function the lookup happens only when someone actually clicks Run, so a
 * missing variable surfaces inside the server action that has a catch and a message for
 * the user, rather than as a build failure unrelated to whoever triggered it.
 *
 * runner/connection.ts can afford constants precisely because it has the opposite
 * problem: a runner with no Redis has nothing to do, so refusing to start is correct.
==============================================================================================
*/

export function queueConnection(): ConnectionOptions {
  const host = process.env.REDIS_HOST?.trim();
  const port = Number(process.env.REDIS_PORT?.trim());

  if (!host) throw new Error('REDIS_HOST is not set');

  // Number(undefined) is NaN and Number('') is 0, so the missing and the malformed
  // cases both land here rather than reaching ioredis as a nonsense port.
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`REDIS_PORT is not a valid port: ${process.env.REDIS_PORT ?? '<unset>'}`);
  }

  return { host, port };
}
