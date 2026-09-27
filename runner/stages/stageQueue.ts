import '../setup/env';
import { connection } from '../setup/connection';
import { Queue } from "bullmq";
import { STAGE_QUEUE } from "@/lib/queue/names"

export interface Payload {
  runId: string;
  stageId: string;
  attempt: number;
}


const stageQueue = new Queue(STAGE_QUEUE, { connection });

const stageJobId = ({ runId, stageId, attempt }: Payload) => `${runId}-${stageId}-${attempt}`;

export async function enqueueStageJob(payload: Payload, delayMs = 0) {
  await stageQueue.add(`stage-${payload.stageId}`, payload, {
    jobId: stageJobId(payload),

    // Here so that BullMQ doesn't re-execute a stage on its own. If a stage fails, just enqueue it again.
    attempts: 1,

    // Only a retry passes a delay. Going straight back in would let a command that fails
    // in 50ms burn a ten-retry budget inside a second, which is never what the number
    // in the editor meant.
    delay: delayMs,
  });
}


/*
==============================================================================================
 * Takes a stage's job back out of Redis, and reports whether the id is free afterwards.
 *
 * Queue.remove returns 1 when the job is not locked — meaning when the job was either
 * successfully removed or not found
 *
 * It returns 0 when the job is locked, meaning a worker holds it.
 * After a crash that lock is the dead process's, and it survives until
 * lockDuration (30s) expires, so a quick restart finds it still held.
 *
 * This means that, after a crash, if you restart the runner after 30s,
 * then the dead process's lock expires and 'stageQueue.remove()' always succeeds.
 *
 * But if you restart within 30 seconds, the lock can still be there.
==============================================================================================
 */
async function removeStageJob(jobId: string): Promise<boolean> {
  return await stageQueue.remove(jobId) === 1;
}

/*
==============================================================================================
 * Tries to remove a stage's job so the stage can be enqueued again. If that fails, the job
 * is still locked by the process that died, so this deletes the lock and tries once more.
 * Returns false if the job still could not be removed.
 * 
 * This function must ONLY be called at boot, before the workers start. Currently, it is 
 * called in the reaper, which runs on boot.
==============================================================================================
 */
export async function reclaimStageJob(payload: Payload): Promise<boolean> {
  const jobId = stageJobId(payload);

  if (await removeStageJob(jobId)) return true;

  // toKey gives the job's own hash key; the lock lives at that key plus ':lock', which is
  // the same string isLocked builds inside the removeJob script.
  const client = await stageQueue.client;
  await client.del(`${stageQueue.toKey(jobId)}:lock`);

  return await removeStageJob(jobId);
}
