import { findStalledRuns, failStalledWebhookEvents } from '../db';
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
 *
 * The same tick also fails webhook events stuck at PENDING (sweepStalledWebhookEvents).
==============================================================================================
*/


// How still a run must be before it is re-enqueued.
const STALL_GRACE_MS = 60_000;

/*
 * How long a webhook event may stay PENDING. The route settles it in milliseconds and GitHub
 * gives up on a delivery after ten seconds, so anything older than this was abandoned.
 */
const WEBHOOK_EVENT_GRACE_MS = 5 * 60_000;

/** How often to look. Cheap when nothing is stalled: one indexed read that returns nothing. */
const SWEEP_INTERVAL_MS = 60_000;



/*
 * Re-enters every run that has been still for longer than the grace period. Returns how many
 * were handed back to the scheduler.
 * 
 * This function cannot tell apart a run that did not need to be sweeped vs a run that did
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


/*
 * Fails webhook events still PENDING after the grace period. Returns how many it failed.
 *
 * Needed incase the database fails in the webhook route and leaves a webhook event 'PENDING' forever.
 * 
 * Just because a webhook event gets left on 'PENDING' does not mean it doesn't trigger a pipeline run -- it absolutely can
 */
export async function sweepStalledWebhookEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - WEBHOOK_EVENT_GRACE_MS);

  let failed = 0;

  try {
    failed = await failStalledWebhookEvents(cutoff);
  } catch (error) {
    console.error('sweeper: could not fail the stalled webhook events:', error);
    return 0;
  }

  if (failed > 0) console.log(`sweeper: failed ${failed} webhook event(s) left PENDING`);

  return failed;
}


let timer: NodeJS.Timeout | null = null;
let sweeping = false;


export function startStalledRunSweep(intervalMs: number = SWEEP_INTERVAL_MS): void {
  if (timer) return;

  timer = setInterval(() => {
    if (sweeping) return;
    sweeping = true;

    // sweep webhook events first since they depend on Postgres. 
    // Then sweep runs next since they depend on both Redis and Postgres.
    void sweepStalledWebhookEvents()
      .then(() => sweepStalledRuns())
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
