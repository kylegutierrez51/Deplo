import { findStalledRuns } from '../db';
import { advanceRun, processRun } from '../runs/runProcessor';

/*
==============================================================================================
 * Every minute, finds runs that have stopped moving and hands them back to the scheduler.
 *
 * A run can stall while the runner is still alive, e.g. a brief Postgres outage uses up all
 * of a run job's retries and leaves the run stuck at QUEUED. Without this, only restarting
 * the runner would recover it.
 *
 * Re-entering a run that is fine is harmless: every write is a compare-and-swap, so a
 * healthy run just reads its rows and does nothing. This is not the reaper on a timer; the
 * reaper deletes locks and fails RUNNING rows, which is only safe at boot.
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
