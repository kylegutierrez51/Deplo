import { runQueue } from './runs';
import { withTimeout } from './timeout';
import type { RunnerAvailability } from '@/lib/types';

/*
==============================================================================================
 * Whether a runner is actually there to consume what the app enqueues.
 *
 * Nothing in Postgres can answer this. A run sits at QUEUED whether the runner is thinking
 * about it or was never started, and those look identical on the Run Detail page — which is
 * the whole reason someone stares at a queued run wondering if it is their pipeline that is
 * broken. The queue is the only party that knows, because BullMQ workers register themselves
 * on their Redis connection and getWorkersCount reads that list back.
 *
 * It counts workers on the run queue specifically. runner/index.ts starts both workers
 * together and closes both together, so one stands in for the other; a runner consuming
 * stages but not runs is not a state this system can reach.
==============================================================================================
*/

/*
 * Bounded for the reason timeout.ts describes: a queue command against a dead Redis never
 * settles, and an unbounded await here would hang the whole Run Detail render rather than
 * showing the banner this exists to feed — turning "the runner is not running" into "the
 * page does not load".
 *
 * Much tighter than the enqueue's budget. This runs on every render of a polling page and
 * has a correct answer to fall back on: a probe that cannot get a reply quickly is reporting
 * a queue nobody should be waiting on anyway.
 */
const PROBE_TIMEOUT_MS = 500;

/*
 * The page polls every couple of seconds and every poll re-renders the server component, so
 * an uncached probe is a CLIENT LIST per tab per interval, forever. Both outcomes are cached
 * alike: the cost of caching the bad one is that the banner can linger for a few seconds
 * after the runner comes back, which is a far better trade than hammering Redis to notice it
 * a little sooner.
 */
const CACHE_TTL_MS = 5_000;

let cached: { at: number, availability: RunnerAvailability } | null = null;

export async function getRunnerAvailability(): Promise<RunnerAvailability> {
  if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) return cached.availability;

  const availability = await probe();
  cached = { at: Date.now(), availability };

  return availability;
}

/*
 * Every failure is the same answer. queueConnection() throws outright when REDIS_HOST is
 * unset — deliberately, so `next build` survives on a machine with no Redis, which includes
 * CI building the app for the E2E suite — and letting that escape would reintroduce exactly
 * the failure that design avoids, on the render path instead of the build. A timeout, a
 * refused connection and a provider that will not run CLIENT LIST all land here too, and
 * none of them is a state in which a run is going to progress.
 */
async function probe(): Promise<RunnerAvailability> {
  try {
    const workers = await withTimeout(runQueue().getWorkersCount(), PROBE_TIMEOUT_MS, 'runner probe');

    return workers > 0 ? { available: true } : { available: false, reason: 'no-workers' };
  } catch {
    return { available: false, reason: 'unreachable' };
  }
}
