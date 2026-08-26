import { findStalledRuns } from './db';
import { advanceRun, processRun } from './runProcessor';

/*
==============================================================================================
 * Re-enters unfinished runs on a timer, for the case where nothing else ever will.
 *
 * A run job that exhausts its attempts leaves no trace on the run row. defaultJobOptions in
 * lib/queue/runs.ts allows three tries with a 2s exponential backoff, so a Postgres blip
 * lasting six seconds at the wrong moment burns the whole budget; the job lands in the
 * failed set, nothing writes to the run, and it sits at QUEUED with the runner alive and
 * happily processing everything else. Nothing in the app can rescue it either — RETRYABLE in
 * lib/actions/run-detail.ts refuses to re-run anything that has not finished, so the only
 * thing anyone can do with it is cancel it.
 *
 * Until this existed the sole recovery was reapAbandonedWork at boot, which is to say
 * restarting the runner.
 *
 * THIS IS DELIBERATELY NOT THE REAPER ON A TIMER. reapAbandonedWork is only safe before
 * worker.run(): reclaimStageJob deletes a job's BullMQ lock, which after a crash belongs to
 * a dead process and mid-flight belongs to a live one, and reapStaleStages would fail the
 * rows of stages that are simply still running. Both would tear apart the work this is
 * supposed to protect.
 *
 * What is left is the one phase that is safe to repeat: read the unfinished runs and hand
 * them back to the scheduler. Every write it can reach from there is a compare-and-swap on
 * an expected status, and readyStages is idempotent by design — the same property that
 * stops a redelivered job or two parents finishing at once from double-enqueuing — so
 * re-entering a run that is progressing normally reads the row and does nothing.
==============================================================================================
*/

/*
 * How still a run must be before it is re-entered. Long enough that the ordinary path — a
 * job waiting its turn, a stage between two writes — is never raced for no reason, short
 * enough that a run killed by a blip is not stranded for the rest of the day.
 */
const STALL_GRACE_MS = 60_000;

/** How often to look. Cheap when nothing is stalled: one indexed read that returns nothing. */
const SWEEP_INTERVAL_MS = 60_000;

/*
 * Re-enters every run that has been still for longer than the grace period. Returns how many
 * were handed back to the scheduler, which counts the no-ops too — this cannot tell a run it
 * rescued from one that never needed it.
 */
export async function sweepStalledRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STALL_GRACE_MS);

  let runs: Awaited<ReturnType<typeof findStalledRuns>> = [];

  try {
    runs = await findStalledRuns(cutoff);
  } catch (error) {
    console.error('sweeper: could not read the stalled runs:', error);
    return 0;
  }

  let swept = 0;

  for (const run of runs) {
    try {
      if (run.status === 'QUEUED') await processRun(run.id);
      else await advanceRun(run.id);

      swept++;

    } catch (error) {
      console.error(`sweeper: could not re-enter run ${run.id}:`, error);
    }
  }

  if (swept > 0) console.log(`sweeper: re-entered ${swept} run(s) that had been still for a while`);

  return swept;
}


let timer: NodeJS.Timeout | null = null;
let sweeping = false;

/*
 * Starts the timer. Safe to call twice; the second call is ignored rather than leaving an
 * interval nobody holds a handle to.
 *
 * Two sweeps overlapping would not corrupt anything — every write underneath is a
 * compare-and-swap — but assuming the database does take the entire 'SWEEP_INTERVAL_MS' time 
 * to sweep stalled runs, then it should definitely not have another reader.
 */
export function startStalledRunSweep(intervalMs: number = SWEEP_INTERVAL_MS): void {
  if (timer) return;

  timer = setInterval(() => {
    if (sweeping) return;
    sweeping = true;

    // sweepStalledRuns handles its own failures; this catch is for the ones it cannot, and
    // it must exist — an unhandled rejection from a timer has no owner and would take the
    // runner down over a database hiccup.
    void sweepStalledRuns()
      .catch(error => console.error('sweeper:', error))
      .finally(() => { sweeping = false; });
  }, intervalMs);

  timer.unref?.();
}

export function stopStalledRunSweep(): void {
  if (!timer) return;

  clearInterval(timer);
  timer = null;
  sweeping = false;
}
