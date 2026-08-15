import {
  reapStaleStages, findUnfinishedRuns, findQueuedStages, updateQueuedToPending, failQueuedStage,
  findRunningStages, openRetry,
} from './db';
import { advanceRun, processRun } from './runProcessor';
import { reclaimStageJob } from './stageQueue';

/*
==============================================================================================
 * Cleans up after a runner that died without finishing what it started. Runs once at boot,
 * before either worker begins consuming.
 *
 * Every transition in this system is a compare-and-swap on an expected status, which works
 * while a process is alive and does nothing whatsoever when one is not. A stage killed
 * mid-command — Ctrl-C, OOM, power loss — leaves a row RUNNING that no caller will ever
 * move again, and a run RUNNING behind it forever. maxStalledCount: 0 is what makes this
 * necessary rather than optional: BullMQ deliberately will not re-execute the job, because
 * CI commands are frequently not idempotent, so the reaper is the visible replacement for
 * the automatic retry we turned off.
 *
 * ASSUMES A SINGLE RUNNER PROCESS. A row carries no way to distinguish "abandoned by a dead
 * process" from "owned by a living one", so booting a second runner against the same
 * database would fail the first one's live stages. Multi-runner is out of scope, and this
 * is the reason.
 *
 * Boot is also the *only* time this runs, which is a real limitation rather than a design
 * goal: a run stalled by a transient Postgres or Redis error mid-flight stays stalled until
 * someone restarts the runner. A repeatable job doing this same pass on an interval is the
 * fix, and is deferred.
==============================================================================================
*/
export async function reapAbandonedWork(): Promise<void> {
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

  if (reaped === 0 && retried === 0 && requeued === 0 && failed === 0 && runs.length === 0) return;

  console.log(
    `reaper: failed ${reaped} abandoned stage(s) and reopened ${retried} of them, requeued ` +
    `${requeued} and failed ${failed} orphaned stage(s), re-examining ${runs.length} run(s)`,
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
 * Decides every QUEUED stage row against the queue, because the row alone cannot say which
 * of three things happened to its job when the runner died.
 *
 * The job never existed — the process died between claimStageForQueue committing and
 * enqueueStageJob returning. Or it is still sitting in Redis, waiting or delayed, and would
 * be delivered perfectly well on its own. Or it was already active, in which case
 * maxStalledCount: 0 has BullMQ fail it without ever entering the processor.
 *
 * Only the middle one recovers unaided, and nothing on the row distinguishes it from the
 * other two — which is why this costs a round trip each. reclaimStageJob collapses all
 * three: it frees the job id, breaking the dead process's lock when it has to, and once no
 * job holds that id the row goes back to PENDING and the run pass dispatches it again.
 * Re-adding without freeing the id first is the trap, since the id is derived from
 * runId/stageId/attempt and BullMQ answers a known id by enqueuing nothing.
 *
 * failQueuedStage is the fallback for a job that is somehow still locked after the break,
 * which at boot means something outside this process's model is holding it — most likely
 * the second runner the single-process assumption says does not exist. Failing the row is
 * the safe reading: it never runs the command twice, and it finalizes the run instead of
 * leaving it hung with nothing scheduled to move it.
 *
 * Per row, so one unreachable job cannot strand the others or stop the boot.
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