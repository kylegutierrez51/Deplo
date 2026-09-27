import {
  reapStaleStages, findUnfinishedRuns, findQueuedStages, updateQueuedToPending, failQueuedStage,
  findRunningStages, openRetry, cancelOrphanedStages,
} from '../db';
import { advanceRun, processRun } from '../runs/runProcessor';
import { reclaimStageJob } from '../stages/stageQueue';

/*
==============================================================================================
 * Runs once at boot and cleans up after a runner that died mid-work: retries or fails
 * stages it left RUNNING, re-dispatches stages it left QUEUED, and hands every unfinished
 * run back to the scheduler.
 *
 * Needed because nothing else will touch that work. BullMQ is set not to re-run a job its
 * worker died on (maxStalledCount: 0), so those rows would sit RUNNING or QUEUED forever.
 *
 * Safe only because it runs before either worker starts and only one runner exists: every
 * RUNNING row and lock it finds must belong to the dead process. A second runner against
 * the same database would have its live stages failed.
==============================================================================================
*/
export async function reapAbandonedWork(): Promise<void> {
  let orphaned = 0;
  try {
    orphaned = await cancelOrphanedStages();
  } catch (error) {
    console.error('reaper: could not close out the stages of cancelled runs:', error);
  }

  const retried = await retryRunningStages();

  let reaped = 0;
  try {
    reaped = await reapStaleStages();
  } catch (error) {
    console.error('reaper: could not fail the abandoned RUNNING rows:', error);
  }

  const { requeued, failed } = await reapQueuedStages();


  let runs: Awaited<ReturnType<typeof findUnfinishedRuns>> = [];
  try {
    runs = await findUnfinishedRuns();
  } catch (error) {
    console.error('reaper: could not read the unfinished runs:', error);
  }

  if (reaped === 0 && retried === 0 && requeued === 0 && failed === 0 && orphaned === 0 && runs.length === 0) return;

  console.log(
    `reaper: failed ${reaped} abandoned stage(s) and reopened ${retried} of them, requeued ` +
    `${requeued} and failed ${failed} orphaned stage(s), cancelled ${orphaned} stage(s) of ` +
    `cancelled run(s), re-examining ${runs.length} run(s)`,
  );

  for (const run of runs) {
    // Per run, so one unreadable definition cannot stop the rest of the queue from being
    // cleaned up — and cannot stop the runner from booting at all.
    try {
      // A QUEUED run may never have been materialized, and advanceRun early-returns on
      // anything that is not RUNNING, so it has to go back through the front door.
      if (run.status === 'QUEUED') await processRun(run.id);
      else await advanceRun(run.id);
    } catch (error) {
      console.error(`reaper: could not recover run ${run.id}:`, error);
    }
  }
}


async function retryRunningStages(): Promise<number> {
  let retried = 0;

  let runningStages: Awaited<ReturnType<typeof findRunningStages>> = [];
  try {
    runningStages = await findRunningStages();
  } catch (error) {
    console.error('reaper: could not read the abandoned RUNNING rows to retry them:', error);
    return retried;
  }

  for (const { stageId, runId, attempt } of runningStages) {
    try {
      if (await openRetry(runId, stageId, attempt)) retried++;
    } catch (error) {
      console.error(`reaper: could not reopen stage ${stageId} of run ${runId}:`, error);
    }
  }

  return retried;
}


/*
==============================================================================================
 * For each QUEUED stage row, removes its job from Redis and resets the row to PENDING so
 * the run pass dispatches it again. If the job cannot be removed, the row is failed.
 *
 * Needed because a QUEUED row doesn't say what happened to its job: it may never have been
 * added, may still be waiting, or may have been running when the runner died. Removing the
 * job first matters, because BullMQ silently ignores an add whose job id already exists.
 *
 * Failing a row that can't be reclaimed is the safe choice: it never runs the command
 * twice, and the run finishes instead of hanging.
==============================================================================================
 */
async function reapQueuedStages(): Promise<{ requeued: number, failed: number }> {
  let requeued = 0;
  let failed = 0;

  let queuedStages: Awaited<ReturnType<typeof findQueuedStages>> = [];
  try {
    queuedStages = await findQueuedStages();
  } catch (error) {
    console.error('reaper: could not read the queued stage rows:', error);
    return { requeued, failed };
  }

  for (const { stageId, runId, attempt } of queuedStages) {
    try {
      if (await reclaimStageJob({ stageId, runId, attempt })) {
        if (await updateQueuedToPending(runId, stageId, attempt)) requeued++;
      } else if (await failQueuedStage(runId, stageId, attempt)) {
        failed++;
      }
    } catch (error) {
      console.error(`reaper: could not recover stage ${stageId} of run ${runId}:`, error);
    }
  }

  return { requeued, failed };
}