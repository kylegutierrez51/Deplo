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
 * Frees a stage's job id so the stage can be enqueued again, breaking a dead process's lock
 * to do it.
 *
 * BOOT ONLY, AND ONLY UNDER THE SINGLE-RUNNER ASSUMPTION. Deleting the lock of a job that a
 * living worker is processing is exactly the corruption Queue.remove refuses to perform:
 * that worker finishes, tries to move a job whose keys are gone, and the stage's result is
 * lost with no trace. The one thing that makes this safe is *when* it runs — reapAbandonedWork
 * calls it before worker.run(), so this process holds no locks, and the single-runner
 * assumption says no other process does either. Every lock visible at that moment is therefore
 * an orphan of the run that died. Calling this from anywhere else is a bug.
 *
 * Why break it at all: the job id is derived from runId/stageId/attempt, and BullMQ answers
 * an add on a known id by handing back the existing job and enqueuing nothing. So while that
 * dead job holds the id, the stage cannot be re-dispatched at all — and it will not run
 * either, since maxStalledCount: 0 has the stalled checker mark it unrecoverable and fail it
 * without ever calling the processor. Left alone the row sits QUEUED forever.
 *
 * Returns false only if the job is *still* locked after the break, which at boot should not
 * happen — the caller treats that as a stage it cannot recover rather than one to retry.
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
