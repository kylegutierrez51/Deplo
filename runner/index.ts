import './env';
import { Worker } from 'bullmq';
import { connection } from './connection';
import { RUN_QUEUE, STAGE_QUEUE } from '@/lib/queue/names';
import { processRun } from './runProcessor';
import { processStage } from './stageProcessor';
import { reapAbandonedWork } from './reaper';
import { startStalledRunSweep, stopStalledRunSweep } from './sweeper';
import { killAllChildren } from './execute';
import type { RunJobData } from '@/lib/queue/runs';
import type { Payload } from './stageQueue';

/*
==============================================================================================
 * The runner's entrypoint, and the only file that creates a consumer.
 *
 * './env' must stay the first import. ESM hoists every import above all statements, so a
 * module that reads process.env at its own module scope — lib/utils/crypto.ts throws on a
 * missing ENCRYPTION_KEY — would otherwise win the race against dotenv. Secret resolution
 * depends on that ordering.
==============================================================================================
*/

/** How long in-flight stages get to finish before shutdown stops waiting for them. */
const SHUTDOWN_TIMEOUT_MS = 30_000;

const workerOptions = {
  connection,
  concurrency: 5,

  // fails a stalled job automatically instead of re-executing it
  maxStalledCount: 0,

  /*
   * Ensures nothing is consumed until main() has reaped the previous process's abandoned work.
   * If set to true, a Worker starts fetching the moment it is constructed, and the first job in
   * would race the reaper for the same rows.
   */
  autorun: false,
};


const runWorker = new Worker<RunJobData>(RUN_QUEUE,
  async (job) => {
    await processRun(job.data.runId);
  }, workerOptions
);

const stageWorker = new Worker<Payload>(STAGE_QUEUE,
  async (job) => {
    await processStage(job.data);
  }, workerOptions
);

// Connection-level failures surface here. Node treats an 'error' event with no listener
// as an unhandled exception and kills the process, so these are not optional.
runWorker.on('error', error => console.error('run worker:', error));
stageWorker.on('error', error => console.error('stage worker:', error));

/*
==============================================================================================
 * Stop accepting work, then let what is already running finish.
 *
 * The point is to leave the reaper as little to do as possible. A hard kill mid-stage means
 * a row stuck RUNNING until the next boot and a possibly orphaned child process; closing
 * cleanly means the stage writes its terminal status, advances its run, and only then does
 * the process exit.
 *
 * The wait is bounded because a stage can legitimately take half an hour, and nobody
 * pressing Ctrl-C is willing to find that out. Stages still running at the deadline are
 * abandoned and reaped on the next boot, which is exactly the case the reaper exists for —
 * but their child processes are killed first. Commands are spawned `detached` on POSIX so
 * the process group can be signalled, which also means they neither receive the terminal's
 * Ctrl-C nor die with this process. Exiting without killAllChildren leaves a command running
 * in a run's workspace that the next boot knows nothing about.
==============================================================================================
*/
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  // Installing a handler removes Node's default terminate, so without this a second Ctrl-C
  // would do nothing at all and leave someone waiting out the full deadline.
  if (shuttingDown) {
    console.error('second signal — exiting now, in-flight stages will be reaped on the next boot');
    killAllChildren();
    process.exit(1);
  }
  shuttingDown = true;

  console.log(`${signal} received — no longer accepting jobs, finishing in-flight stages`);

  stopStalledRunSweep();

  const deadline = setTimeout(() => {
    console.error(`shutdown still waiting after ${SHUTDOWN_TIMEOUT_MS}ms — exiting anyway`);
    killAllChildren();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await Promise.all([runWorker.close(), stageWorker.close()]);
  } catch (error) {
    console.error('shutdown:', error);
  }

  clearTimeout(deadline);
  // A clean close means every stage already finished, so this is normally a no-op. It is
  // here for the paths that are not clean.
  killAllChildren();
  console.log('runner stopped');
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(signal));
}

async function main(): Promise<void> {
  await reapAbandonedWork();

  // Explicit .catch on each: run() returns a promise that settles when the worker stops,
  // and an unhandled rejection there would take the process down with no diagnosis.
  runWorker.run().catch(error => console.error('run worker stopped:', error));
  stageWorker.run().catch(error => console.error('stage worker stopped:', error));

  startStalledRunSweep();

  console.log(`runner listening on "${RUN_QUEUE}" and "${STAGE_QUEUE}"`);
}

main().catch(error => {
  console.error('runner failed to start:', error);
  process.exit(1);
});
