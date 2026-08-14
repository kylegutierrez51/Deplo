import { reapStaleStages, findUnfinishedRuns } from './db';
import { advanceRun, processRun } from './runProcessor';

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
  const reaped = await reapStaleStages();

  /*
   * Every unfinished run, not only the ones with a stage just reaped. A crash in the window
   * between finishStage and advanceRun leaves a run whose stages are all terminal and whose
   * status is still RUNNING — no stale row to find, and nothing that will ever finalize it.
   * Both entry points recompute from the full outcome set and are idempotent, so calling
   * them on a run that was genuinely fine costs nothing.
   */
  const runs = await findUnfinishedRuns();

  if (reaped === 0 && runs.length === 0) return;

  console.log(`reaper: failed ${reaped} abandoned stage(s), re-examining ${runs.length} run(s)`);

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
