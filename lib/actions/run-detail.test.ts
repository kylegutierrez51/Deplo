import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { retryRun, cancelRun } from '@/lib/actions/run-detail';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { setSession, signedOut, sessionWithoutUserId } from '@/test/mocks/auth';
import { enqueuePipelineRun } from '@/lib/queue/runs';
import type { RunStatus as PrismaRunStatus } from '@/generated/prisma/client';

jest.mock('@/lib/prisma');
jest.mock('@/auth');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));
// A factory rather than an automock: the real module imports bullmq, which pulls in
// ioredis and opens a socket. This action only ever calls enqueuePipelineRun.
jest.mock('@/lib/queue/runs', () => ({
  enqueuePipelineRun: jest.fn(),
}));

/*
 * retryRun inserts a row and rings a bell, and nearly everything worth pinning is about
 * *which* row rather than about the happy path.
 *
 * The load-bearing decision is that a retry is a new PipelineRun, not the old one reset.
 * Both queues derive their jobIds from the run id, and BullMQ answers an add on a known
 * id by returning the existing job and enqueuing nothing — so a version that reused the
 * row would still compile, still report success, and still pass any test that only
 * checked the status it wrote, while hanging the run: every stage claimed QUEUED and
 * never dispatched, because completed stage jobs are kept in Redis forever. The tests
 * below therefore assert on `create` and on the *absence* of writes to the old row.
 *
 * cancelRun, further down, is the mirror image: it writes no new row at all. Marking the run
 * terminal *is* the stop switch, because advanceRun early-returns on anything that is not
 * RUNNING — so its assertions are about the guard on that write, and about which stage rows
 * it does and does not sweep.
 */

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const enqueue = enqueuePipelineRun as jest.MockedFunction<typeof enqueuePipelineRun>;

/** The old run as findUnique's `select` returns it. */
const existingRun = (status: PrismaRunStatus = 'FAILED') =>
  prismaMock.pipelineRun.findUnique.mockResolvedValue({
    status,
    pipelineId: 'pipe-1',
    definitionId: 'def-3',
    environmentId: 'env-2',
  } as never);

const created = (id = 'run-2') =>
  prismaMock.pipelineRun.create.mockResolvedValue({ id } as never);

/** The arguments the insert was called with. */
const inserted = () => prismaMock.pipelineRun.create.mock.calls[0][0];

const retry = () => retryRun('run-1');

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  enqueue.mockClear();
  enqueue.mockResolvedValue(undefined);
  setSession();
  existingRun();
  created();
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('who may retry', () => {
  it.each([
    ['signed out', signedOut],
    ['a session carrying no user id', sessionWithoutUserId],
  ])('refuses %s', async (_label, withSession) => {
    withSession();

    expect(await retry()).toEqual({
      status: 'error',
      message: 'Sign in to run a pipeline.',
    });
  });

  it('writes nothing and wakes nothing when signed out', async () => {
    signedOut();

    await retry();

    expect(prismaMock.pipelineRun.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  // The retry is attributed to whoever pressed the button, while the original run keeps
  // its own triggeredBy — which is only possible because this is a separate row.
  it('attributes the new run to the signed-in user', async () => {
    setSession('user-7');

    await retry();

    expect(inserted().data).toEqual(expect.objectContaining({ triggeredById: 'user-7' }));
  });
});

describe('which runs may be retried', () => {
  it('refuses a run that no longer exists', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(null as never);

    expect(await retry()).toEqual({
      status: 'error',
      message: 'This run no longer exists. It cannot be re-run.',
    });
  });

  /*
   * The guard is an exhaustive Record keyed on the Prisma enum, so these two cases are
   * the whole non-terminal half of it. A run the runner still owns must not get a second
   * run: both would materialize into the same workspace directory, which is keyed on the
   * run id the runner is currently working in.
   */
  it.each<PrismaRunStatus>(['QUEUED', 'RUNNING'])('refuses a %s run', async (status) => {
    existingRun(status);

    expect(await retry()).toEqual({
      status: 'error',
      message: 'This run has not finished yet.',
    });
  });

  it.each<PrismaRunStatus>(['QUEUED', 'RUNNING'])('inserts nothing for a %s run', async (status) => {
    existingRun(status);

    await retry();

    expect(prismaMock.pipelineRun.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each<PrismaRunStatus>(['SUCCEEDED', 'FAILED', 'CANCELLED'])('accepts a %s run', async (status) => {
    existingRun(status);

    expect((await retry()).status).toBe('success');
  });
});

describe('the new run', () => {
  // The heart of it: a new row, and the old one left exactly as it was. Any update or
  // delete against the old run is the reused-row design coming back.
  it('inserts a run rather than touching the old one', async () => {
    await retry();

    expect(prismaMock.pipelineRun.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.pipelineRun.update).not.toHaveBeenCalled();
    expect(prismaMock.pipelineRun.updateMany).not.toHaveBeenCalled();
  });

  /*
   * The old run's stage rows carry every log snippet, exit code and approval the first
   * attempt produced, and the Run Detail page is the only place they are ever shown.
   * Clearing them to make room for a re-run destroys that history irrecoverably.
   */
  it('deletes none of the old run stage results', async () => {
    await retry();

    expect(prismaMock.stageResult.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  /*
   * definitionId is copied from the old run, not looked up. Reading the pipeline's latest
   * definition instead would silently re-run a different graph than the one the button is
   * attached to, on a pipeline edited since.
   */
  it('pins the retry to the definition the old run ran', async () => {
    await retry();

    expect(prismaMock.pipelineDefinition.findFirst).not.toHaveBeenCalled();
    expect(inserted().data).toEqual(expect.objectContaining({ definitionId: 'def-3' }));
  });

  it('carries over the pipeline and the environment', async () => {
    await retry();

    expect(inserted().data).toEqual(expect.objectContaining({
      pipelineId: 'pipe-1',
      environmentId: 'env-2',
    }));
  });

  // A retry is a person pressing a button, whatever started the run being retried.
  it('records the retry as manually triggered', async () => {
    await retry();

    expect(inserted().data).toEqual(expect.objectContaining({ trigger: 'MANUAL' }));
  });

  /*
   * status is left to the schema default (QUEUED), and startedAt/finishedAt stay null.
   * Copying the old run's timestamps forward is what produced a negative duration on the
   * reused row: lib/data/run-detail.ts reads finishedAt to decide the run has a duration
   * at all, so a fresh startedAt against a stale finishedAt renders as ending before it
   * began.
   */
  it('starts clean, with no status or timestamps copied forward', async () => {
    await retry();

    expect(inserted().data).not.toEqual(expect.objectContaining({ status: expect.anything() }));
    expect(inserted().data).not.toEqual(expect.objectContaining({ startedAt: expect.anything() }));
    expect(inserted().data).not.toEqual(expect.objectContaining({ finishedAt: expect.anything() }));
  });
});

describe('waking the runner', () => {
  /*
   * The new id, never the one that was passed in. Enqueuing the old run id would collide
   * with the `${runId}-trigger` jobId its original trigger already used, and BullMQ would
   * return that job and enqueue nothing — leaving the retry at QUEUED with no error.
   */
  it('enqueues the new run id, not the one being retried', async () => {
    created('run-2');

    await retry();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('run-2');
  });

  // A floating enqueue would let this rejection escape unhandled while the action reported
  // success — the retry stranded at QUEUED, the user told it was running.
  it('waits for the enqueue instead of leaving it in flight', async () => {
    enqueue.mockRejectedValue(new Error('redis unreachable'));

    expect((await retry()).status).toBe('error');
  });

  /*
   * The row is committed before the enqueue, so a queue that cannot be reached would leave
   * the retry at QUEUED with no job behind it — and RETRYABLE refuses to re-run anything
   * unfinished, so it could not even be retried from the page it appears on. Discarding it
   * is what stops a failed trigger from leaving a run nobody can do anything with.
   */
  it('discards the new run when the enqueue fails', async () => {
    enqueue.mockRejectedValue(new Error('redis unreachable'));

    await retry();

    expect(prismaMock.pipelineRun.delete).toHaveBeenCalledWith({ where: { id: 'run-2' } });
  });

  // The queue is what failed, so the message has to say so — "please try again" over a
  // Redis that is down sends someone round the same loop.
  it('names the queue in the message when the enqueue fails', async () => {
    enqueue.mockRejectedValue(new Error('redis unreachable'));

    expect((await retry()).message).toMatch(/job queue/);
  });
});

describe('after a retry', () => {
  // The run list gains a row, and the old run's page has to re-render — the Re-run button
  // it shows is the one that was just pressed.
  it.each(['/runs', '/runs/run-1'])('revalidates %s', async (path) => {
    await retry();

    expect(revalidate).toHaveBeenCalledWith(path);
  });

  /*
   * The id is what lets the caller navigate to the run that will actually move. Without
   * it the user stays on the old run's page, which is terminal and will never change
   * again however long the auto-refresh polls it.
   */
  it('returns the new run id so the caller can follow it', async () => {
    created('run-2');

    expect(await retry()).toEqual({
      status: 'success',
      message: 'Run retried!',
      runId: 'run-2',
    });
  });
});

describe('when the insert fails', () => {
  /*
   * P2003 is the real race: the definition or environment the new row points at was
   * deleted between the read and the insert. Both ids are copied from a row that was
   * valid a moment earlier, so this is a foreign key failure rather than bad input.
   */
  it.each(['P2003', 'P2025'])('reports %s as a missing pipeline or environment', async (code) => {
    prismaMock.pipelineRun.create.mockRejectedValue(prismaError(code));

    expect(await retry()).toEqual({
      status: 'error',
      message: 'This pipeline or environment no longer exists.',
    });
  });

  it('reports an unrecognised failure in the caller own terms', async () => {
    prismaMock.pipelineRun.create.mockRejectedValue(prismaError('P2002'));

    expect(await retry()).toEqual({
      status: 'error',
      message: 'Error retrying run. Please try again.',
    });
  });

  it('does not wake the runner', async () => {
    prismaMock.pipelineRun.create.mockRejectedValue(prismaError('P2003'));

    await retry();

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not revalidate, so the page it re-renders is not a lie', async () => {
    prismaMock.pipelineRun.create.mockRejectedValue(prismaError('P2003'));

    await retry();

    expect(revalidate).not.toHaveBeenCalled();
  });
});

/*
 * cancelRun writes intent and lets the runner catch up. Two writes, in order: the run row
 * first, which stops all further scheduling the moment it commits, then the stage rows that
 * will now never run.
 *
 * The RUNNING stage is deliberately absent from that sweep — the runner owns it, kills the
 * command, and writes the row itself. Sweeping it here would race the runner for a row it
 * still holds, and record a stage as cancelled while its command was still executing.
 */
describe('cancelRun', () => {
  const swept = () => prismaMock.stageResult.updateMany.mock.calls[0][0];
  /** The statuses the sweep named, cast past Prisma's filter union. */
  const sweptStatuses = () => (swept().where?.status as { in: string[] }).in;
  const cancelledRun = () => prismaMock.pipelineRun.updateMany.mock.calls[0][0];

  /** How many run rows the CAS matched: 1 won, 0 means the run was already terminal. */
  const matched = (count: number) =>
    prismaMock.pipelineRun.updateMany.mockResolvedValue({ count } as never);

  const cancel = () => cancelRun('run-1');

  beforeEach(() => {
    matched(1);
    prismaMock.stageResult.updateMany.mockResolvedValue({ count: 2 } as never);
  });

  describe('who may cancel', () => {
    it.each([
      ['signed out', signedOut],
      ['a session carrying no user id', sessionWithoutUserId],
    ])('refuses %s', async (_label, withSession) => {
      withSession();

      expect(await cancel()).toEqual({
        status: 'error',
        message: 'Sign in to cancel a run.',
      });
    });

    it('writes nothing when signed out', async () => {
      signedOut();

      await cancel();

      expect(prismaMock.pipelineRun.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.stageResult.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('the compare-and-swap on the run', () => {
    /*
     * The guard is the whole concurrency story here. Without the status filter a finished
     * run could be dragged back to CANCELLED from a stale tab, overwriting the outcome it
     * had already recorded and the finishedAt that went with it.
     */
    it('will only move a run that has not finished', async () => {
      await cancel();

      expect(cancelledRun().where).toEqual({
        id: 'run-1',
        status: { in: ['QUEUED', 'RUNNING'] },
      });
    });

    it('stamps the run cancelled and finished', async () => {
      await cancel();

      expect(cancelledRun().data).toEqual({
        status: 'CANCELLED',
        finishedAt: expect.any(Date),
      });
    });

    // Not overwritten the way the old stub did: it records who *triggered* the run, and a
    // cancel is a different act by a possibly different person.
    it('leaves triggeredById alone', async () => {
      setSession('user-7');

      await cancel();

      expect(cancelledRun().data).not.toEqual(
        expect.objectContaining({ triggeredById: expect.anything() }),
      );
    });
  });

  describe('losing the race', () => {
    // count === 0 covers both a run that finished first and a run id matching nothing.
    beforeEach(() => { matched(0); });

    it('reports that the run already finished', async () => {
      expect(await cancel()).toEqual({
        status: 'error',
        message: 'This run has already finished.',
      });
    });

    it('sweeps no stages', async () => {
      await cancel();

      expect(prismaMock.stageResult.updateMany).not.toHaveBeenCalled();
    });

    it('does not revalidate, so the page it re-renders is not a lie', async () => {
      await cancel();

      expect(revalidate).not.toHaveBeenCalled();
    });
  });

  describe('the stage sweep', () => {
    /*
     * AWAITING_APPROVAL has to be in here. getApprovals filters on stage status alone with
     * no run-status filter, so omitting it leaves a live approval card for a cancelled run
     * — and deciding it would write APPROVED on a run nothing will ever advance.
     */
    it('cancels the stages that will now never run', async () => {
      await cancel();

      expect(swept()).toEqual({
        where: { runId: 'run-1', status: { in: ['PENDING', 'QUEUED', 'AWAITING_APPROVAL'] } },
        data: { status: 'CANCELLED', finishedAt: expect.any(Date) },
      });
    });

    // The one the runner owns. It is mid-command, and only runner/execute.ts can stop it;
    // writing the row here would record it cancelled while its command was still running.
    it('leaves the RUNNING stage to the runner', async () => {
      await cancel();

      expect(sweptStatuses()).not.toContain('RUNNING');
    });

    // Keyed on runId, not id: StageResult.id is the row's own cuid, so `where: { id }`
    // would match nothing and silently sweep no stages at all.
    it('sweeps by run id rather than row id', async () => {
      await cancel();

      expect(swept().where).toEqual(expect.objectContaining({ runId: 'run-1' }));
    });

    /*
     * The run row is written first, and that ordering is the stop switch: from the moment
     * it commits advanceRun early-returns, so nothing can claim a stage while this sweep
     * is still in flight.
     */
    it('marks the run before touching the stages', async () => {
      await cancel();

      expect(prismaMock.pipelineRun.updateMany.mock.invocationCallOrder[0])
        .toBeLessThan(prismaMock.stageResult.updateMany.mock.invocationCallOrder[0]);
    });
  });

  describe('after a cancel', () => {
    // /approvals too: a gate on this run has just stopped being decidable, and its card
    // has to leave the queue.
    it.each(['/runs', '/runs/run-1', '/approvals'])('revalidates %s', async (path) => {
      await cancel();

      expect(revalidate).toHaveBeenCalledWith(path);
    });

    it('reports success', async () => {
      expect(await cancel()).toEqual({ status: 'success', message: 'Run cancelled!' });
    });

    // Nothing to tell the runner: advanceRun would early-return on a cancelled run anyway,
    // and the stage still executing finds out by polling.
    it('does not enqueue anything', async () => {
      await cancel();

      expect(enqueue).not.toHaveBeenCalled();
    });
  });

  describe('when the write fails', () => {
    it('reports the failure in its own terms', async () => {
      prismaMock.pipelineRun.updateMany.mockRejectedValue(prismaError('P2025'));

      expect(await cancel()).toEqual({
        status: 'error',
        message: 'Error cancelling run. Please try again.',
      });
    });

    it('does not revalidate when the stage sweep fails', async () => {
      prismaMock.stageResult.updateMany.mockRejectedValue(prismaError('P2003'));

      await cancel();

      expect(revalidate).not.toHaveBeenCalled();
    });
  });
});
