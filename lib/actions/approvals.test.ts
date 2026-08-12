import { revalidatePath } from 'next/cache';
import { prismaError } from '@/test/helpers/prisma-errors';
import { approveOrRejectStage } from '@/lib/actions/approvals';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { setSession, signedOut, sessionWithoutUserId } from '@/test/mocks/auth';
import { enqueuePipelineRun } from '@/lib/queue/runs';

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
 * This action writes one row and rings one bell, and almost everything worth asserting is
 * about the conditions on those two steps rather than about their happy path.
 *
 * The write is a compare-and-swap, the same mechanism as runner/db.ts: the where clause
 * names the status the row is expected to be in, and `count` is an ownership signal rather
 * than an error code. Drop the guard and the action still compiles, still returns success,
 * and still passes any test that only decides an untouched approval — while allowing a
 * decided stage to be re-decided, and allowing any StageResult at all to be written
 * APPROVED, which the scheduler reads as success and acts on.
 *
 * The bell is the only thing that resumes the run. A decision that is written but never
 * enqueued strands the run forever with no UI path back, because the stage no longer
 * matches getApprovals' AWAITING_APPROVAL filter and its card is gone.
 */

const revalidate = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const enqueue = enqueuePipelineRun as jest.MockedFunction<typeof enqueuePipelineRun>;

/** How many rows the CAS matched: 1 won the race, 0 lost it. */
const matched = (count: number) =>
  prismaMock.stageResult.updateMany.mockResolvedValue({ count } as never);

const decide = (approved: boolean) => approveOrRejectStage('row-1', 'run-1', 'deploy-gate', approved);
const approve = () => decide(true);
const reject = () => decide(false);

const written = () => prismaMock.stageResult.updateMany.mock.calls[0][0];

beforeEach(() => {
  resetPrismaMock();
  revalidate.mockClear();
  enqueue.mockClear();
  enqueue.mockResolvedValue(undefined);
  setSession();
  matched(1);
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('who may decide', () => {
  // Unlike most actions, the signed-out path here is not merely an attribution question:
  // an approval whose approvedById is null records that a gate was opened by nobody.
  it.each([
    ['signed out', signedOut],
    ['a session carrying no user id', sessionWithoutUserId],
  ])('refuses %s', async (_label, withSession) => {
    withSession();

    expect(await approve()).toEqual({
      status: 'error',
      message: 'Sign in to approve a pipeline.',
    });
  });

  it('writes nothing and wakes nothing when signed out', async () => {
    signedOut();

    await approve();

    expect(prismaMock.stageResult.updateMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('attributes the decision to the signed-in user', async () => {
    setSession('user-7');

    await approve();

    expect(written().data).toEqual(expect.objectContaining({ approvedById: 'user-7' }));
  });
});

describe('the compare-and-swap', () => {
  // The guard is the entire concurrency story, and it does two jobs at once. `status`
  // stops a decided approval being re-decided from a stale tab; `stageType` stops the
  // id of any other stage — including one that is mid-execution — being written APPROVED
  // by a hand-crafted call, since every argument here arrives from the client.
  it('will only move a row that is an approval and is still awaiting one', async () => {
    await approve();

    expect(written().where).toEqual({
      id: 'row-1',
      runId: 'run-1',
      stageId: 'deploy-gate',
      stageType: 'APPROVAL',
      status: 'AWAITING_APPROVAL',
    });
  });

  it.each([
    ['approved', true, 'APPROVED'],
    ['rejected', false, 'UNAPPROVED'],
  ])('writes %s as %s', async (_label, approved, status) => {
    await decide(approved);

    expect(written().data).toEqual(expect.objectContaining({ status }));
  });

  // finishedAt as well as approvedAt: the stage is over either way, and the Run Detail
  // page reads finishedAt to show a duration. Without it an approved stage renders as
  // still in flight on a run that has long since moved on.
  it('stamps both the decision time and the finish time', async () => {
    await approve();

    expect(written().data).toEqual(expect.objectContaining({
      approvedAt: expect.any(Date),
      finishedAt: expect.any(Date),
    }));
  });
});

describe('losing the race', () => {
  // count === 0 means the row was not AWAITING_APPROVAL when this call landed — another
  // reviewer decided it first, or the page was stale. Not an error condition: the caller
  // simply did not win, and the honest report is that the decision already happened.
  beforeEach(() => { matched(0); });

  it('reports that the approval was already decided', async () => {
    expect(await reject()).toEqual({
      status: 'error',
      message: 'This approval has already been decided.',
    });
  });

  // The important half. A rejection that lost the race must not wake the run on behalf of
  // a decision it did not make — and this is the case that reading `count` exists to
  // catch, since updateMany reports a miss rather than throwing the way update would.
  it('does not wake the runner', async () => {
    await reject();

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not revalidate, so the page it re-renders is not a lie', async () => {
    await reject();

    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe('waking the runner', () => {
  it('hands the run id to the queue', async () => {
    await approve();

    expect(enqueue).toHaveBeenCalledWith('run-1', expect.any(String));
  });

  /*
   * The tag becomes part of the jobId, and BullMQ returns the existing job instead of
   * enqueuing when a jobId is already in the keyspace. That is what makes a retried
   * enqueue harmless — and what would silently swallow the second decision if both
   * approvals of one run shared a tag. Keying on stageId is the fix, so it is pinned.
   */
  it('tags the job per stage rather than per kind of event', async () => {
    await approveOrRejectStage('row-a', 'run-1', 'gate-a', true);
    await approveOrRejectStage('row-b', 'run-1', 'gate-b', true);

    expect(enqueue).toHaveBeenNthCalledWith(1, 'run-1', 'approval:gate-a');
    expect(enqueue).toHaveBeenNthCalledWith(2, 'run-1', 'approval:gate-b');
  });

  // A floating enqueue would let this rejection escape as an unhandled rejection while the
  // action reported success — the run stranded, the user told it resumed.
  it('waits for the enqueue instead of leaving it in flight', async () => {
    enqueue.mockRejectedValue(new Error('redis unreachable'));

    expect((await approve()).status).toBe('error');
  });

  /*
   * TODO(bug): the decision is already committed by the time the enqueue fails, and there
   * is no undo. The stage no longer matches getApprovals' AWAITING_APPROVAL filter, so its
   * card disappears and no button remains to retry with — the run waits forever at RUNNING.
   * The plan defers the fix (a boot reaper, or an outbox) and accepts the window; this pins
   * it as a known cost rather than a surprise.
   */
  it('leaves the decision written when the enqueue fails', async () => {
    enqueue.mockRejectedValue(new Error('redis unreachable'));

    await approve();

    expect(prismaMock.stageResult.updateMany).toHaveBeenCalled();
  });
});

describe('after a decision', () => {
  // Three paths show this stage: the queue it leaves, the run list, and the run itself.
  it.each(['/approvals', '/runs', '/runs/run-1'])('revalidates %s', async (path) => {
    await approve();

    expect(revalidate).toHaveBeenCalledWith(path);
  });

  it.each([
    ['approved', true, 'Stage approved'],
    ['rejected', false, 'Stage rejected'],
  ])('reports a stage %s', async (_label, approved, message) => {
    expect(await decide(approved)).toEqual({ status: 'success', message });
  });
});

describe('when the write fails', () => {
  beforeEach(() => {
    prismaMock.stageResult.updateMany.mockRejectedValue(prismaError('P2003'));
  });

  it('reports the failure in the caller’s own terms', async () => {
    expect(await reject()).toEqual({
      status: 'error',
      message: 'Error rejecting stage. Please try again.',
    });
  });

  it('does not wake the runner', async () => {
    await reject();

    expect(enqueue).not.toHaveBeenCalled();
  });
});
