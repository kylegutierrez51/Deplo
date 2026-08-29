import { runQueue } from './runs';
import { withTimeout } from './timeout';
import type { RunnerAvailability } from '@/lib/types';


const PROBE_TIMEOUT_MS = 500;
const CACHE_TTL_MS = 5_000;
const UNHEALTHY_GRACE_MS = 15_000;

interface HealthState {
  cached: { at: number, availability: RunnerAvailability } | null;

  // When the current unbroken run of unhealthy probes started. Null while healthy.
  unhealthySince: number | null;
}


const globalForHealth = global as unknown as { runnerHealth?: HealthState };

const state = (): HealthState => (globalForHealth.runnerHealth ??= { cached: null, unhealthySince: null });


async function probeCached(): Promise<RunnerAvailability> {
  const health = state();

  if (health.cached && (Date.now() - health.cached.at) < CACHE_TTL_MS) return health.cached.availability;

  const availability = await probe();
  health.cached = { at: Date.now(), availability };

  return availability;
}


// used to display RunStatusBanner in run detail page
// settle makes the cache wait for the 'unhealthySince' grace before returning 'available: false'
export async function getRunnerAvailability(): Promise<RunnerAvailability> {
  return settle(await probeCached());
}


// used before creating a pipeline run, ignores 'unhealthySince' grace
// "reason: 'no-workers'" returns true since queueWorker() recycles its blocking connection for ~1 second every 30 seconds. So it must not block a trigger.
export async function isQueueReachable(): Promise<boolean> {
  const probed = await probeCached();

  return probed.available || probed.reason !== 'unreachable';
}


// checks if runner/redis is currently available
async function probe(): Promise<RunnerAvailability> {
  try {
    const workers = await withTimeout(runQueue().getWorkersCount(), PROBE_TIMEOUT_MS, 'runner probe');

    return workers > 0 ? { available: true } : { available: false, reason: 'no-workers' }; // runner issue
  } catch {
    return { available: false, reason: 'unreachable' }; // redis issue
  }
}


/* 
==============================================================================================
 * uses probe() to see if 'available: false' has been always returned in the past 
 * 'UNHEALTHY_GRACE_MS' seconds since 'getWorkersCount()' typically returns 1 but can return 
 * 0 for ~1 second every ~30 seconds since the worker recycles its blocking connection.
 * It prevents RunStatusBanner from falsely reporting that the runner/queue is unavailable
==============================================================================================
*/ 
function settle(probed: RunnerAvailability): RunnerAvailability {

  const health = state();

  if (probed.available) {
    health.unhealthySince = null;
    return probed;
  }

  health.unhealthySince ??= Date.now();

  return (Date.now() - health.unhealthySince) < UNHEALTHY_GRACE_MS ? { available: true } : probed;
}
