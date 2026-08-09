import './env';
import { Worker } from 'bullmq';
import { connection } from './connection';
import { RUN_QUEUE, STAGE_QUEUE } from '@/lib/queue/names';
import { processRun } from './runProcessor';
import { processStage } from './stageProcessor';
import type { RunJobData } from '@/lib/queue/runs';
import type { Payload } from './stageQueue';

/*
==============================================================================================
 * The runner's entrypoint, and the only file that creates a consumer.
 *
 * './env' must stay the first import. ESM hoists every import above all statements, so a
 * module that reads process.env at its own module scope — lib/utils/crypto.ts throws on a
 * missing ENCRYPTION_KEY — would otherwise win the race against dotenv.
==============================================================================================
*/

// The processors receive a BullMQ Job; the payload is on job.data.
const runWorker = new Worker<RunJobData>(RUN_QUEUE, 
  async (job) => {
    processRun(job.data.runId)
  }, { connection, concurrency: 5 }
);

// processRun ends by calling advanceRun itself, so there is nothing to chain here.
const stageWorker = new Worker<Payload>(STAGE_QUEUE,
  async (job) => {
    processStage(job.data)
  }, { connection, concurrency: 5 }
);

// Connection-level failures surface here. Node treats an 'error' event with no listener
// as an unhandled exception and kills the process, so these are not optional.
runWorker.on('error', error => console.error('run worker:', error));
stageWorker.on('error', error => console.error('stage worker:', error));

console.log(`runner listening on "${RUN_QUEUE}" and "${STAGE_QUEUE}"`);