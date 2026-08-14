import { reapAbandonedWork } from './reaper';
import { reapStaleStages, findUnfinishedRuns } from './db';
import { advanceRun, processRun } from './runProcessor';

// Explicit factories, not automocks: db reaches lib/prisma and runProcessor reaches
// stageQueue, and loading either for real opens a socket. See stageProcessor.test.ts.
jest.mock('./db', () => ({ reapStaleStages: jest.fn(), findUnfinishedRuns: jest.fn() }));
jest.mock('./runProcessor', () => ({ advanceRun: jest.fn(), processRun: jest.fn() }));

const reap = reapStaleStages as jest.MockedFunction<typeof reapStaleStages>;
const unfinished = findUnfinishedRuns as jest.MockedFunction<typeof findUnfinishedRuns>;
const advance = advanceRun as jest.MockedFunction<typeof advanceRun>;
const start = processRun as jest.MockedFunction<typeof processRun>;

const runs = (...rows: { id: string, status: 'QUEUED' | 'RUNNING' }[]) =>
  unfinished.mockResolvedValue(rows as never);

beforeEach(() => {
  jest.clearAllMocks();
  reap.mockResolvedValue(0);
  runs();
  advance.mockResolvedValue(undefined);
  start.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => { });
  jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

it('does nothing on a clean boot', async () => {
  await reapAbandonedWork();

  expect(advance).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

// Order matters: advanceRun recomputes from the stage rows, so a stale RUNNING row still
// present when it runs reads as in-flight and the run is left exactly as stuck as before.
it('fails the abandoned rows before re-examining anything', async () => {
  reap.mockResolvedValue(1);
  runs({ id: 'run-1', status: 'RUNNING' });

  await reapAbandonedWork();

  expect(reap.mock.invocationCallOrder[0]).toBeLessThan(advance.mock.invocationCallOrder[0]);
});

/*
 * Deliberately wider than "runs that had a stage reaped". A crash in the window between
 * finishStage and advanceRun leaves a run whose stages are all terminal and whose status is
 * still RUNNING — there is no stale row to find, and without this pass nothing would ever
 * finalize it.
 */
it('advances every running run, not only the ones it reaped', async () => {
  reap.mockResolvedValue(0);
  runs({ id: 'run-1', status: 'RUNNING' }, { id: 'run-2', status: 'RUNNING' });

  await reapAbandonedWork();

  expect(advance).toHaveBeenCalledWith('run-1');
  expect(advance).toHaveBeenCalledWith('run-2');
});

/*
 * A QUEUED run may never have been materialized at all — processRun writes the stage rows
 * before it sets RUNNING. advanceRun early-returns on anything that is not RUNNING, so
 * sending a QUEUED run through it would recover nothing and hide the problem.
 */
it('sends a queued run back through processRun, not advanceRun', async () => {
  runs({ id: 'run-1', status: 'QUEUED' });

  await reapAbandonedWork();

  expect(start).toHaveBeenCalledWith('run-1');
  expect(advance).not.toHaveBeenCalled();
});

it('picks the right entry point per run when both kinds are stranded', async () => {
  runs({ id: 'queued-run', status: 'QUEUED' }, { id: 'running-run', status: 'RUNNING' });

  await reapAbandonedWork();

  expect(start).toHaveBeenCalledWith('queued-run');
  expect(start).not.toHaveBeenCalledWith('running-run');
  expect(advance).toHaveBeenCalledWith('running-run');
});

// This runs before the workers start consuming, so a throw here would take the boot with
// it — one run with an unreadable definition would stop the runner from starting at all.
it('keeps going when one run cannot be recovered', async () => {
  runs({ id: 'bad-run', status: 'RUNNING' }, { id: 'good-run', status: 'RUNNING' });
  advance.mockRejectedValueOnce(new Error('definition is not valid JSON'));

  await expect(reapAbandonedWork()).resolves.toBeUndefined();
  expect(advance).toHaveBeenCalledWith('good-run');
});
