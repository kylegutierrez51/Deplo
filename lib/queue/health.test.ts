import { runQueue } from './runs';

/*
 * The queue module is mocked rather than the Redis under it: runs.ts constructs a real
 * BullMQ Queue, which opens an ioredis connection at first call and would leave the suite
 * with an open handle even if a Redis happened to be listening.
 *
 * health.ts keeps its cache and its grace window on globalThis, deliberately, so that Next
 * re-evaluating the module cannot reset either. isolateModulesAsync is still used to import
 * a fresh module instance — that is precisely what a dev edit does — but the state behind it
 * has to be cleared in beforeEach instead, since it now outlives the module.
 */
jest.mock('./runs', () => ({ runQueue: jest.fn() }));

const queue = runQueue as jest.MockedFunction<typeof runQueue>;

const workersCount = (impl: () => Promise<number>) =>
  queue.mockReturnValue({ getWorkersCount: impl } as unknown as ReturnType<typeof runQueue>);

/** One probe against a cold module. An unhealthy answer is still inside its grace window. */
async function check() {
  let result;

  await jest.isolateModulesAsync(async () => {
    const { getRunnerAvailability } = await import('./health');
    result = await getRunnerAvailability();
  });

  return result;
}

/*
 * What the page settles on once an unhealthy reading has persisted.
 *
 * A single bad probe is deliberately withheld — see the grace note in health.ts — so the
 * only way to observe the real answer is to keep probing past the window. Date.now is
 * stubbed rather than slept through: the module measures both its cache TTL and its grace
 * with it, and this walks the clock past each in turn.
 */
async function checkSettled() {
  const now = jest.spyOn(Date, 'now');
  let result;

  try {
    await jest.isolateModulesAsync(async () => {
      const { getRunnerAvailability } = await import('./health');

      now.mockReturnValue(0);
      await getRunnerAvailability();          // opens the grace window

      now.mockReturnValue(20_000);            // past both the 5s cache and the 15s grace
      result = await getRunnerAvailability();
    });
  } finally {
    now.mockRestore();
  }

  return result;
}

beforeEach(() => {
  jest.clearAllMocks();

  // health.ts memoizes on globalThis so its state survives Next's dev module re-evaluation
  // — which also means it survives jest.isolateModulesAsync, and would leak between cases.
  delete (global as { runnerHealth?: unknown }).runnerHealth;
});

describe('getRunnerAvailability', () => {
  it('reports available when a worker is consuming the run queue', async () => {
    workersCount(async () => 1);

    expect(await check()).toEqual({ available: true });
  });

  /*
   * The case the banner exists for. Redis answered perfectly well — there is simply nobody
   * on the other end of it, which is what a run sitting at QUEUED forever actually means
   * and what no amount of reading Postgres can tell you.
   */
  it('reports no-workers when the queue has no consumers', async () => {
    workersCount(async () => 0);

    expect(await checkSettled()).toEqual({ available: false, reason: 'no-workers' });
  });

  it('reports unreachable when the probe rejects', async () => {
    workersCount(() => Promise.reject(new Error('ECONNREFUSED')));

    expect(await checkSettled()).toEqual({ available: false, reason: 'unreachable' });
  });

  /*
   * The false positive this grace exists for, and the regression test for it.
   *
   * A BullMQ Worker recycles its blocking connection roughly every 30s, and getWorkersCount
   * is a CLIENT LIST filtered by connection name — so for about a second the runner is
   * genuinely absent from the list while working perfectly. Measured against a live runner,
   * that is a zero reading once a minute or two, and the 5s cache holds each one on screen.
   * Believing a single zero is what put the banner on a healthy run.
   */
  it('withholds a lone zero rather than calling a healthy runner missing', async () => {
    workersCount(async () => 0);

    expect(await check()).toEqual({ available: true });
  });

  // The window is not a mute button: a zero that outlasts the blip is the real thing.
  it('believes a zero once it has outlasted the grace window', async () => {
    workersCount(async () => 0);

    expect(await checkSettled()).toEqual({ available: false, reason: 'no-workers' });
  });

  /*
   * The window has to close behind a runner that came back, or one blip early in a long
   * session would leave every later blip counting toward the same window and the banner
   * would eventually fire on a healthy runner anyway.
   */
  it('closes the window again once a worker is seen', async () => {
    const getWorkersCount = jest.fn<Promise<number>, []>()
      .mockResolvedValueOnce(0)   // blip
      .mockResolvedValueOnce(1)   // recovered — window must reset here
      .mockResolvedValue(0);      // a fresh blip, far later
    queue.mockReturnValue({ getWorkersCount } as unknown as ReturnType<typeof runQueue>);

    const now = jest.spyOn(Date, 'now');

    try {
      await jest.isolateModulesAsync(async () => {
        const { getRunnerAvailability } = await import('./health');

        now.mockReturnValue(0);
        await getRunnerAvailability();
        now.mockReturnValue(6_000);
        await getRunnerAvailability();

        // Well past the grace measured from the *first* blip, but only one probe into the
        // second one. A window that never reset would report unavailable here.
        now.mockReturnValue(30_000);
        expect(await getRunnerAvailability()).toEqual({ available: true });
      });
    } finally {
      now.mockRestore();
    }
  });

  /*
   * The state lives on globalThis precisely so a module re-evaluation cannot restart the
   * grace window, and this is the regression test for that: isolateModulesAsync gives each
   * import a fresh module registry, which is what Next does on every dev edit.
   *
   * Held in module scope, the second import would start a brand new window and report the
   * queue as available again — the banner disappearing for another fifteen seconds while
   * Redis was still down, which is exactly what it did.
   */
  it('keeps the grace window across a module re-evaluation', async () => {
    workersCount(async () => 0);

    const now = jest.spyOn(Date, 'now');

    try {
      now.mockReturnValue(0);
      await check();            // opens the window in one module instance

      now.mockReturnValue(20_000);
      expect(await check()).toEqual({ available: false, reason: 'no-workers' });
    } finally {
      now.mockRestore();
    }
  });

  /*
   * queueConnection() throws outright on an unset REDIS_HOST, by design, so that `next
   * build` survives on a machine with no Redis — CI included. That throw arrives from
   * runQueue() itself rather than from the promise, and escaping it here would push the
   * failure that design avoids onto the render path.
   */
  it('reports unreachable when the queue cannot even be constructed', async () => {
    queue.mockImplementation(() => { throw new Error('REDIS_HOST is not set'); });

    expect(await checkSettled()).toEqual({ available: false, reason: 'unreachable' });
  });

  /*
   * The reason there is a timeout at all. queueConnection() sets maxRetriesPerRequest: null
   * explicitly, so a command issued while Redis is down is not rejected — it waits for
   * Redis to come back. Awaiting that from the Run Detail server component would hang the
   * render instead of showing the banner, turning "the runner is not running" into "the
   * page does not load".
   */
  it('reports unreachable rather than hanging when the probe never settles', async () => {
    jest.useFakeTimers();
    workersCount(() => new Promise<number>(() => { }));

    try {
      await jest.isolateModulesAsync(async () => {
        const { getRunnerAvailability } = await import('./health');

        // That this settles at all is the point: the getWorkersCount promise never will.
        const first = getRunnerAvailability();
        await jest.advanceTimersByTimeAsync(600);
        expect(await first).toEqual({ available: true });

        // Past the cache and the grace, a second timeout is believed rather than withheld.
        await jest.advanceTimersByTimeAsync(20_000);
        const second = getRunnerAvailability();
        await jest.advanceTimersByTimeAsync(600);
        expect(await second).toEqual({ available: false, reason: 'unreachable' });
      });
    } finally {
      jest.useRealTimers();
    }
  });

  /*
   * The page re-renders on a 2s poll, so an uncached probe is a CLIENT LIST per tab per
   * interval. Both outcomes are cached alike — the cost is a banner that can linger a few
   * seconds after the runner returns, which beats hammering Redis to notice it sooner.
   */
  it('serves repeat calls from the cache within the TTL', async () => {
    const getWorkersCount = jest.fn<Promise<number>, []>().mockResolvedValue(0);
    queue.mockReturnValue({ getWorkersCount } as unknown as ReturnType<typeof runQueue>);

    await jest.isolateModulesAsync(async () => {
      const { getRunnerAvailability } = await import('./health');

      // Withheld by the grace either way; what this pins is that the second call did not
      // re-probe, not what the answer was.
      expect(await getRunnerAvailability()).toEqual({ available: true });
      expect(await getRunnerAvailability()).toEqual({ available: true });
    });

    expect(getWorkersCount).toHaveBeenCalledTimes(1);
  });

  it('probes again once the TTL has passed', async () => {
    const getWorkersCount = jest.fn<Promise<number>, []>().mockResolvedValue(0);
    queue.mockReturnValue({ getWorkersCount } as unknown as ReturnType<typeof runQueue>);

    const now = jest.spyOn(Date, 'now');

    try {
      await jest.isolateModulesAsync(async () => {
        const { getRunnerAvailability } = await import('./health');

        now.mockReturnValue(0);
        await getRunnerAvailability();

        now.mockReturnValue(5_001);
        await getRunnerAvailability();
      });

      expect(getWorkersCount).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
});

describe('isQueueReachable', () => {
  it('lets a trigger through when a worker is consuming the run queue', async () => {
    workersCount(async () => 1);

    await jest.isolateModulesAsync(async () => {
      const { isQueueReachable } = await import('./health');
      expect(await isQueueReachable()).toBe(true);
    });
  });

  /*
   * The distinction the reason code exists for. Redis answered, so queue.add will land and
   * the run waits at QUEUED until a worker comes back — nothing has failed, and refusing the
   * trigger here would turn "start it when the runner returns" into an error the user has to
   * act on. It is also the flappy reading: a worker recycling its blocking connection reports
   * zero for about a second every thirty.
   */
  it('lets a trigger through when the queue has no consumers', async () => {
    workersCount(async () => 0);

    await jest.isolateModulesAsync(async () => {
      const { isQueueReachable } = await import('./health');
      expect(await isQueueReachable()).toBe(true);
    });
  });

  /*
   * The whole point of not going through getRunnerAvailability. One failed probe is enough:
   * the grace window withholds this same reading from the banner for another fifteen seconds,
   * and waiting it out here would wave through exactly the burst of triggers this exists to
   * refuse — each one writing a run row that enqueueOrDiscardRun then has to delete.
   */
  it('refuses on the first unreachable probe, without waiting out the grace window', async () => {
    workersCount(() => Promise.reject(new Error('ECONNREFUSED')));

    await jest.isolateModulesAsync(async () => {
      const { getRunnerAvailability, isQueueReachable } = await import('./health');

      expect(await isQueueReachable()).toBe(false);
      // Same probe, same instant: the banner is still deliberately claiming otherwise.
      expect(await getRunnerAvailability()).toEqual({ available: true });
    });
  });

  it('reads unreachable when the queue cannot even be constructed', async () => {
    queue.mockImplementation(() => { throw new Error('REDIS_HOST is not set'); });

    await jest.isolateModulesAsync(async () => {
      const { isQueueReachable } = await import('./health');
      expect(await isQueueReachable()).toBe(false);
    });
  });

  // Both readers draw on one probe, so a user clicking Run repeatedly during an outage is
  // answered immediately and costs a single round trip.
  it('shares the cached probe with getRunnerAvailability', async () => {
    const getWorkersCount = jest.fn<Promise<number>, []>().mockResolvedValue(1);
    queue.mockReturnValue({ getWorkersCount } as unknown as ReturnType<typeof runQueue>);

    await jest.isolateModulesAsync(async () => {
      const { getRunnerAvailability, isQueueReachable } = await import('./health');

      await getRunnerAvailability();
      await isQueueReachable();
      await isQueueReachable();
    });

    expect(getWorkersCount).toHaveBeenCalledTimes(1);
  });
});
