import { Queue, Worker } from "bullmq";
import type { CompressedStagePayload } from "./types";
import { sleep } from './util';

const REDIS_HOST = process.env.REDIS_HOST ?? (() => {
  throw new Error("REDIS_HOST is not set");
})();

const REDIS_PORT = process.env.REDIS_PORT ?? (() => {
  throw new Error("REDIS_PORT is not set");
})();

const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT)
}

const stageQueue = new Queue("pipeline-stages", { connection });


async function enqueueStage(payload: CompressedStagePayload) {
  await stageQueue.add(`stage-${payload.stageId}`, payload, {
    jobId: `${payload.runId}:${payload.stageId}:${payload.attempt}`,
  });

  worker.on('completed', (job) => {
    console.log(job);
    console.log(`${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`${job?.id ?? 'unknown job'} has failed with ${err.message}!`);
  });
}







const worker = new Worker("pipeline-stages", 
  async (job) => {
    
  }
)