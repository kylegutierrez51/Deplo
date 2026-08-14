import './env';
import { connection } from './connection';
import { Queue } from "bullmq";
import { STAGE_QUEUE } from "@/lib/queue/names"

export interface Payload {
  runId: string;
  stageId: string;
  attempt: number;
}


const stageQueue = new Queue(STAGE_QUEUE, { connection });

export async function enqueueStageJob(payload: Payload, delayMs = 0) {
  await stageQueue.add(`stage-${payload.stageId}`, payload, {
    jobId: `${payload.runId}:${payload.stageId}:${payload.attempt}`,

    // Here so that BullMQ doesn't re-execute a stage on its own. If a stage fails, just enqueue it again.
    attempts: 1,

    // Only a retry passes a delay. Going straight back in would let a command that fails
    // in 50ms burn a ten-retry budget inside a second, which is never what the number
    // in the editor meant.
    delay: delayMs,
  });
}

