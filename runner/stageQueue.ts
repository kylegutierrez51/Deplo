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

export async function enqueueStageJob(payload: Payload) {
  await stageQueue.add(`stage-${payload.stageId}`, payload, {
    jobId: `${payload.runId}:${payload.stageId}:${payload.attempt}`,
    // Retries are ours, tracked as attempt+1 rows in Postgres. BullMQ must never
    // re-execute a stage on its own — CI commands are frequently not idempotent.
    attempts: 1,
  });
}

