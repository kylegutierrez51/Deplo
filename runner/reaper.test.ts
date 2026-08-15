import { reapAbandonedWork } from './reaper';
import {
  reapStaleStages, findUnfinishedRuns, findQueuedStages, updateQueuedToPending, failQueuedStage,
} from './db';
import { advanceRun, processRun } from './runProcessor';
import { reclaimStageJob } from './stageQueue';

// Explicit factories, not automocks: db reaches lib/prisma, runProcessor reaches stageQueue,
// and stageQueue constructs a bullmq Queue at module scope. Loading any of them for real
// opens a socket — and bullmq is ESM far enough down that the suite does not even parse.
jest.mock('./db', () => ({
  reapStaleStages: jest.fn(), findUnfinishedRuns: jest.fn(),
  findQueuedStages: jest.fn(), updateQueuedToPending: jest.fn(), failQueuedStage: jest.fn(),
}));
jest.mock('./runProcessor', () => ({ advanceRun: jest.fn(), processRun: jest.fn() }));
jest.mock('./stageQueue', () => ({ reclaimStageJob: jest.fn() }));

const reap = reapStaleStages as jest.MockedFunction<typeof reapStaleStages>;
const unfinished = findUnfinishedRuns as jest.MockedFunction<typeof findUnfinishedRuns>;
const queued = findQueuedStages as jest.MockedFunction<typeof findQueuedStages>;
const requeue = updateQueuedToPending as jest.MockedFunction<typeof updateQueuedToPending>;
const failQueued = failQueuedStage as jest.MockedFunction<typeof failQueuedStage>;
const removeJob = reclaimStageJob as jest.MockedFunction<typeof reclaimStageJob>;
const advance = advanceRun as jest.MockedFunction<typeof advanceRun>;
const start = processRun as jest.MockedFunction<typeof processRun>;

const runs = (...rows: { id: string, status: 'QUEUED' | 'RUNNING' }[]) =>
  unfinished.mockResolvedValue(rows as never);

const queuedStages = (...rows: { runId: string, stageId: string, attempt: number }[]) =>
  queued.mockResolvedValue(rows as never);

const stage = { runId: 'run-1', stageId: 'build', attempt: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  reap.mockResolvedValue(0);
  runs();
  queuedStages();
  removeJob.mockResolvedValue(true);
  requeue.mockResolvedValue(true);
  failQueued.mockResolvedValue(true);
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

/*
 * A QUEUED row is the one status the row itself cannot explain. Its job may never have been
 * created, may still be waiting in Redis, or may have been active when the process died —
 * three different fates, one status. The queue is the only thing that knows which, and
 * Queue.remove is what asks: it reports success for a job it removed AND for one that was
 * never there, and failure only for a job still locked by a worker.
 */
describe('the queued stage sweep', () => {
  /*
   * Both of the recoverable windows land here, because the queue answers them identically.
   * Nothing was there to remove (the process died between claimStageForQueue committing and
   * enqueueStageJob returning), or the job was sitting in waiting/delayed and has now been
   * taken back — either way no job holds that id, so the row can go back to PENDING and be
   * dispatched again by the run pass below.
   */
  it.each([
    ['the job was never enqueued'],
    ['the job was still waiting in Redis'],
  ])('hands the stage back as PENDING when %s', async () => {
    queuedStages(stage);
    removeJob.mockResolvedValue(true);

    await reapAbandonedWork();

    expect(requeue).toHaveBeenCalledWith('run-1', 'build', 1);
    expect(failQueued).not.toHaveBeenCalled();
  });

  /*
   * The third fate is handled inside reclaimStageJob, which breaks the dead process's lock
   * and removes the job — so from here it looks like any other success. This case is what is
   * left when even that loses: at boot nothing of ours holds a lock, so a job still locked
   * after the break is being held by something outside the single-process assumption.
   * Failing the row finalizes the run rather than leaving it hung, and never double-runs.
   */
  it('fails the stage instead when the job could not be taken back', async () => {
    queuedStages(stage);
    removeJob.mockResolvedValue(false);

    await reapAbandonedWork();

    expect(failQueued).toHaveBeenCalledWith('run-1', 'build', 1);
    expect(requeue).not.toHaveBeenCalled();
  });

  // The job id is built from all three, so dropping one addresses a different attempt's job
  // — or none at all, which reads as "never enqueued" and resets a row whose job is live.
  it('addresses the job by run, stage and attempt', async () => {
    queuedStages({ runId: 'run-1', stageId: 'build', attempt: 3 });

    await reapAbandonedWork();

    expect(removeJob).toHaveBeenCalledWith({ runId: 'run-1', stageId: 'build', attempt: 3 });
  });

  // Order matters as much as it does for reapStaleStages: this pass only writes PENDING, and
  // advanceRun is what turns that back into a job. Running it afterwards would leave every
  // recovered stage sitting PENDING until something else happened to advance the run.
  it('runs before the runs are re-examined', async () => {
    queuedStages(stage);
    runs({ id: 'run-1', status: 'RUNNING' });

    await reapAbandonedWork();

    expect(requeue.mock.invocationCallOrder[0]).toBeLessThan(advance.mock.invocationCallOrder[0]);
  });

  it('keeps going when one stage cannot be recovered', async () => {
    queuedStages({ runId: 'run-1', stageId: 'bad', attempt: 1 }, { runId: 'run-1', stageId: 'good', attempt: 1 });
    removeJob.mockRejectedValueOnce(new Error('redis is unreachable'));

    await expect(reapAbandonedWork()).resolves.toBeUndefined();
    expect(requeue).toHaveBeenCalledWith('run-1', 'good', 1);
  });

  // Same reasoning as the per-run catch: everything here happens before worker.run(), so an
  // unhandled rejection reaches main() and exits the process. Unrecovered work is recoverable
  // on the next boot; a runner that will not boot is not.
  it.each([
    ['the RUNNING sweep', () => reap.mockRejectedValue(new Error('postgres is unreachable'))],
    ['the queued read', () => queued.mockRejectedValue(new Error('postgres is unreachable'))],
  ])('still re-examines the runs when %s fails', async (_label, breakIt) => {
    breakIt();
    runs({ id: 'run-1', status: 'RUNNING' });

    await expect(reapAbandonedWork()).resolves.toBeUndefined();
    expect(advance).toHaveBeenCalledWith('run-1');
  });
});
