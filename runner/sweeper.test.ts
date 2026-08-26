import { sweepStalledRuns, startStalledRunSweep, stopStalledRunSweep } from './sweeper';
import { findStalledRuns } from './db';
import { advanceRun, processRun } from './runProcessor';

// Explicit factories, not automocks, for the reason reaper.test.ts gives: db reaches
// lib/prisma and runProcessor reaches stageQueue, which constructs a bullmq Queue at module
// scope. Loading either for real opens a socket.
jest.mock('./db', () => ({ findStalledRuns: jest.fn() }));
jest.mock('./runProcessor', () => ({ advanceRun: jest.fn(), processRun: jest.fn() }));

const stalled = findStalledRuns as jest.MockedFunction<typeof findStalledRuns>;
const advance = advanceRun as jest.MockedFunction<typeof advanceRun>;
const start = processRun as jest.MockedFunction<typeof processRun>;

const runs = (...rows: { id: string, status: 'QUEUED' | 'RUNNING' }[]) =>
  stalled.mockResolvedValue(rows as never);

beforeEach(() => {
  jest.clearAllMocks();

  // Same as reaper.test.ts: the error paths are half of what is under test here, and their
  // logging is noise that buries the actual failures.
  jest.spyOn(console, 'log').mockImplementation(() => { });
  jest.spyOn(console, 'error').mockImplementation(() => { });

  runs();
  advance.mockResolvedValue(undefined);
  start.mockResolvedValue(undefined);
});

afterEach(() => {
  stopStalledRunSweep();
});

describe('sweepStalledRuns', () => {
  /*
   * The split the boot reaper makes for the same reason: advanceRun early-returns on
   * anything that is not RUNNING, so a QUEUED run — which may never have been materialized
   * at all, since that is the step the failed job never reached — has to go back through
   * processRun rather than being advanced.
   */
  it('re-enters a QUEUED run through processRun and a RUNNING one through advanceRun', async () => {
    runs({ id: 'run-queued', status: 'QUEUED' }, { id: 'run-running', status: 'RUNNING' });

    expect(await sweepStalledRuns()).toBe(2);
    expect(start).toHaveBeenCalledWith('run-queued');
    expect(start).not.toHaveBeenCalledWith('run-running');
    expect(advance).toHaveBeenCalledWith('run-running');
    expect(advance).not.toHaveBeenCalledWith('run-queued');
  });

  // The grace period is what keeps this off runs the ordinary path is still working on.
  // A cutoff in the future would sweep every run on every tick.
  it('asks only for runs that have been still since before the grace period', async () => {
    const before = Date.now();
    await sweepStalledRuns();
    const after = Date.now();

    const cutoff = stalled.mock.calls[0][0];

    expect(cutoff.getTime()).toBeLessThanOrEqual(before - 60_000);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(after - 60_000 - 1_000);
  });

  it('does nothing when no run has been still long enough', async () => {
    expect(await sweepStalledRuns()).toBe(0);
    expect(start).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });

  /*
   * Per run, like the boot reaper: one run whose definition will not deserialize must not
   * stop every other stalled run from being recovered. A sweep that gave up on the first
   * failure would be at its least useful exactly when the database is unhappy.
   */
  it('carries on past a run it cannot re-enter', async () => {
    runs({ id: 'bad', status: 'RUNNING' }, { id: 'good', status: 'RUNNING' });
    advance.mockRejectedValueOnce(new Error('definition is not readable'));

    expect(await sweepStalledRuns()).toBe(1);
    expect(advance).toHaveBeenCalledWith('good');
  });

  // It runs from a timer, where a rejection has no owner and would take the runner down
  // over a database blip — which is the very thing it exists to recover from.
  it('reports zero rather than throwing when the read itself fails', async () => {
    stalled.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await sweepStalledRuns()).toBe(0);
  });
});

describe('the sweep timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopStalledRunSweep();
    jest.useRealTimers();
  });

  it('sweeps once per interval', async () => {
    startStalledRunSweep(1_000);

    await jest.advanceTimersByTimeAsync(3_500);

    expect(stalled).toHaveBeenCalledTimes(3);
  });

  /*
   * Overlapping sweeps would not corrupt anything — every write underneath is a
   * compare-and-swap — but a database slow enough to overrun the interval is the last one
   * that needs a second copy of the same reads piled on top of the first.
   */
  it('drops a tick that lands while the previous sweep is still running', async () => {
    let release: () => void = () => { };
    stalled.mockReturnValue(new Promise(resolve => { release = () => resolve([]); }));

    startStalledRunSweep(1_000);
    await jest.advanceTimersByTimeAsync(3_500);

    expect(stalled).toHaveBeenCalledTimes(1);

    release();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_000);

    expect(stalled).toHaveBeenCalledTimes(2);
  });

  // Calling it twice must not leave an interval nobody holds a handle to — stop would
  // clear one and the orphan would keep firing for the life of the process.
  it('ignores a second start rather than running two timers', async () => {
    startStalledRunSweep(1_000);
    startStalledRunSweep(1_000);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(stalled).toHaveBeenCalledTimes(1);
  });

  it('stops sweeping once stopped', async () => {
    startStalledRunSweep(1_000);
    await jest.advanceTimersByTimeAsync(1_000);

    stopStalledRunSweep();
    await jest.advanceTimersByTimeAsync(5_000);

    expect(stalled).toHaveBeenCalledTimes(1);
  });
});
