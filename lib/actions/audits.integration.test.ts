import prisma from '@/lib/prisma';
import type { AuditAction } from '@/generated/prisma';
import { updatePipeline, deletePipeline } from '@/lib/actions/pipelines';
import { cancelRun } from '@/lib/actions/run-detail';
import { makePipeline, makeUser, makeDefinition, makeRun } from '@/test/integration/factories';
import { setSession } from '@/test/mocks/auth';

jest.mock('@/auth');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));
// Both action modules import these; neither case below reaches a queue.
jest.mock('@/lib/queue/runs', () => ({ enqueuePipelineRun: jest.fn() }));
jest.mock('@/lib/queue/health', () => ({ isQueueReachable: jest.fn() }));

/*
 * The claim under test is that a write and its audit commit together or not at all — which
 * only Postgres can confirm. The unit tier proves the audit is *sent* to the transaction
 * client; it cannot prove that a failed insert actually takes the write back with it.
 *
 * The audit is made to fail for a reason that occurs in production rather than by injection:
 * sessions are JWTs, so a cookie outlives the deletion of its user, and audit_logs.userId is
 * a foreign key to users. That session's audit insert raises P2003 inside the transaction.
 * The actions chosen here write no user id to the resource row itself, so the audit is the
 * only statement that can fail — addPipeline and savePipelineDefinition would trip the same
 * key on createdById first and prove nothing about the audit.
 */

const idle = { status: 'idle' as const, message: '' };

const pipelineForm = (id: string, name: string) => {
  const fd = new FormData();
  fd.set('id', id);
  fd.set('name', name);
  fd.set('repo_url', 'https://github.com/o/r');
  fd.set('description', '');
  return fd;
};

/** A session whose user row no longer exists. */
const signedInAsDeletedUser = () => setSession('user-deleted-after-sign-in');

const auditsFor = (resourceId: string, action?: AuditAction) => prisma.auditLog.findMany({ where: { resourceId, ...(action && { action }) } });

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('updatePipeline', () => {
  it('commits the rename together with its audit', async () => {
    const user = await makeUser();
    setSession(user.id);
    const pipeline = await makePipeline({ name: 'CI' });

    await updatePipeline(idle, pipelineForm(pipeline.id, 'Renamed'));

    expect((await prisma.pipeline.findUniqueOrThrow({ where: { id: pipeline.id } })).name).toBe('Renamed');
    expect(await auditsFor(pipeline.id)).toEqual([
      expect.objectContaining({ action: 'PIPELINE_UPDATED', userId: user.id, resourceLabel: 'CI → Renamed' }),
    ]);
  });

  it('leaves the name unchanged when the audit cannot be written', async () => {
    signedInAsDeletedUser();
    const pipeline = await makePipeline({ name: 'CI' });

    const result = await updatePipeline(idle, pipelineForm(pipeline.id, 'Renamed'));

    expect(result.status).toBe('error');
    expect((await prisma.pipeline.findUniqueOrThrow({ where: { id: pipeline.id } })).name).toBe('CI');
    expect(await auditsFor(pipeline.id)).toEqual([]);
  });
});

describe('deletePipeline', () => {
  it('keeps the pipeline when the audit cannot be written', async () => {
    signedInAsDeletedUser();
    const pipeline = await makePipeline();

    const result = await deletePipeline(pipeline.id);

    expect(result.status).toBe('error');
    expect(await prisma.pipeline.findUnique({ where: { id: pipeline.id } })).not.toBeNull();
    expect(await auditsFor(pipeline.id)).toEqual([]);
  });
});

describe('cancelRun', () => {
  /** A QUEUED run with one stage that has not started, triggered by a real user. */
  const queuedRunWithStage = async () => {
    const triggerer = await makeUser();
    const pipeline = await makePipeline({ name: 'CI' });
    const definition = await makeDefinition(pipeline.id, 0);
    const run = await makeRun(pipeline.id, definition.id, triggerer.id);
    await prisma.stageResult.create({
      data: { runId: run.id, stageId: 'a', stageName: 'a', stageType: 'CUSTOM', status: 'PENDING' },
    });
    return run;
  };

  const stateOf = async (runId: string) => ({
    run: (await prisma.pipelineRun.findUniqueOrThrow({ where: { id: runId } })).status,
    stages: (await prisma.stageResult.findMany({ where: { runId } })).map(s => s.status),
  });

  it('commits the cancel, the sweep and the audit together', async () => {
    const run = await queuedRunWithStage();
    const canceller = await makeUser();
    setSession(canceller.id);

    await cancelRun(run.id);

    expect(await stateOf(run.id)).toEqual({ run: 'CANCELLED', stages: ['CANCELLED'] });
    // queuedRunWithStage's makeRun already audited RUN_TRIGGERED against this same resourceId,
    // so this scopes to the action under test rather than the run's whole audit trail.
    expect(await auditsFor(run.id, 'RUN_CANCELLED')).toEqual([
      expect.objectContaining({ action: 'RUN_CANCELLED', userId: canceller.id, resourceLabel: `CI #${run.runNumber}` }),
    ]);
  });

  /*
   * The case the transaction boundary exists for. With the run write committed on its own
   * this ends CANCELLED with a PENDING stage and no audit — and because the retry the error
   * invites then reports "already finished", that state is permanent.
   */
  it('leaves the run and its stages untouched when the audit cannot be written', async () => {
    const run = await queuedRunWithStage();
    signedInAsDeletedUser();

    const result = await cancelRun(run.id);

    expect(result.status).toBe('error');
    expect(await stateOf(run.id)).toEqual({ run: 'QUEUED', stages: ['PENDING'] });
    expect(await auditsFor(run.id, 'RUN_CANCELLED')).toEqual([]);
  });

  // And because nothing committed, trying again is a real retry rather than a dead end.
  it('can still be cancelled once the audit can be written', async () => {
    const run = await queuedRunWithStage();
    signedInAsDeletedUser();
    await cancelRun(run.id);

    setSession((await makeUser()).id);
    const result = await cancelRun(run.id);

    expect(result).toEqual({ status: 'success', message: 'Run cancelled!' });
    expect(await auditsFor(run.id, 'RUN_CANCELLED')).toHaveLength(1);
  });
});
