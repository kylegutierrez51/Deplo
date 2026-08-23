import {
  loadRunContext, materializeStages, startRunIfQueued, claimStageForQueue,
  claimStageForApproval, markStageRunning, finishStage, finalizeRun, cancelPendingAwaitingQueuedStages,
  openRetry, reapStaleStages, findUnfinishedRuns, findQueuedStages, updateQueuedToPending,
  failQueuedStage, findRunningStages, recordStageProgress, isRunCancelled, cancelOrphanedStages,
} from './db';
import { graph } from '@/test/helpers/graph';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { prismaError } from '@/test/helpers/prisma-errors';
import { mkdir } from 'node:fs/promises';

jest.mock('@/lib/prisma');
jest.mock('node:fs/promises', () => ({ mkdir: jest.fn() }));

/*
 * db.ts is the only place the runner touches Prisma, and almost all of it is
 * compare-and-swap: an updateMany whose `where` names the status the row is expected to
 * be in, returning count === 1 when this caller won.
 *
 * That guard status is the entire concurrency story. Drop it from a where clause and the
 * function still compiles, still returns true, and still passes any test that only checks
 * the happy path — while silently reintroducing double-enqueue. So the assertions here
 * are deliberately about the *where clause*, not about the return value: they are
 * regression tests for a specific mistake rather than descriptions of behaviour.
 *
 * The other recurring mistake they pin is `id` in place of `runId`. StageResult.id is the
 * row's own cuid, so `where: { id: runId }` matches nothing, every CAS reports a loss, and
 * the run deadlocks with no error anywhere.
 */

const updated = (count: number) => ({ count }) as never;
const mkdirMock = mkdir as jest.MockedFunction<typeof mkdir>;

beforeEach(() => {
  resetPrismaMock();
  mkdirMock.mockClear();
  process.env.RUNNER_WORKSPACE_ROOT = '/workspaces';
});

describe('loadRunContext', () => {
  const run = (over: Record<string, unknown> = {}) => ({
    id: 'run-1',
    status: 'RUNNING',
    definitionId: 'def-1',
    environmentId: 'env-1',
    definition: { graphJson: graph('a b', 'a>b'), configJson: { a: { command: 'npm ci' } } },
    stages: [],
    ...over,
  });

  it('returns null for a run that does not exist', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(null as never);

    expect(await loadRunContext('gone')).toBeNull();
  });

  // The ordering is inert today — one row per stage — and load-bearing from the moment
  // retries land, because the fold below is last-write-wins.
  it('asks for stages oldest attempt first, so the fold keeps the latest', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(run() as never);

    await loadRunContext('run-1');

    expect(prismaMock.pipelineRun.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        stages: expect.objectContaining({
          orderBy: [{ stageId: 'asc' }, { attempt: 'asc' }],
        }),
      }),
    }));
  });

  it('keys outcomes by stageId, not by the row id', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(run({
      stages: [{ stageId: 'a', status: 'SUCCEEDED' }, { stageId: 'b', status: 'QUEUED' }],
    }) as never);

    const ctx = await loadRunContext('run-1');

    expect(ctx?.outcomes).toEqual(new Map([['a', 'SUCCEEDED'], ['b', 'QUEUED']]));
  });

  // Retry rows arrive as duplicate keys; ascending attempt is what makes the survivor
  // the newest one rather than the oldest.
  it('lets a later attempt overwrite an earlier one', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(run({
      stages: [{ stageId: 'a', status: 'FAILED' }, { stageId: 'a', status: 'SUCCEEDED' }],
    }) as never);

    const ctx = await loadRunContext('run-1');

    expect(ctx?.outcomes.get('a')).toBe('SUCCEEDED');
  });

  // advanceRun used to hardcode attempt 1 when claiming a stage, which was correct only
  // while retries did not exist. It reads this map instead now, so a retry is claimed and
  // enqueued as attempt 2 rather than losing the CAS against a row that is already FAILED.
  it('reports the latest attempt number per stage', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(run({
      stages: [
        { stageId: 'a', status: 'FAILED', attempt: 1 },
        { stageId: 'a', status: 'PENDING', attempt: 2 },
        { stageId: 'b', status: 'PENDING', attempt: 1 },
      ],
    }) as never);

    const ctx = await loadRunContext('run-1');

    expect(ctx?.attempts).toEqual(new Map([['a', 2], ['b', 1]]));
  });

  it('returns an empty outcome map before anything has been materialized', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(run() as never);

    expect((await loadRunContext('run-1'))?.outcomes.size).toBe(0);
  });

  // fromDefinition merges configJson into node.data, which is why RunContext carries no
  // separate config field for anything to fall out of step with.
  it('merges the config into the graph rather than returning it separately', async () => {
    prismaMock.pipelineRun.findUnique.mockResolvedValue(run() as never);

    const ctx = await loadRunContext('run-1');

    expect(ctx?.graph.nodes.find(node => node.id === 'a')?.data.command).toBe('npm ci');
    expect(ctx).not.toHaveProperty('config');
  });
});

describe('materializeStages', () => {
  const rows = () => (prismaMock.stageResult.createMany.mock.calls[0]?.[0]?.data ?? []) as Record<string, unknown>[];

  it('writes one PENDING row per node, keyed by the graph node id', async () => {
    await materializeStages('run-1', graph('a b', 'a>b'));

    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toEqual(expect.objectContaining({
      runId: 'run-1', stageId: 'a', status: 'PENDING', attempt: 1,
    }));
  });

  // The unique constraint is [runId, stageId, attempt]; without skipDuplicates a
  // redelivered run job would throw P2002 instead of doing nothing.
  it('skips duplicates so a second call is a no-op', async () => {
    await materializeStages('run-1', graph('a'));

    expect(prismaMock.stageResult.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('translates the editor stage types to the Prisma enum', async () => {
    await materializeStages('run-1', graph('a b:approval c:deploy'));

    expect(rows().map(row => row.stageType)).toEqual(['CUSTOM', 'APPROVAL', 'DEPLOY']);
  });

  it('denormalizes command and maxRetries onto the row', async () => {
    const definition = graph('a');
    definition.nodes[0].data.command = 'npm test';
    definition.nodes[0].data.retries = 2;

    await materializeStages('run-1', definition);

    expect(rows()[0]).toEqual(expect.objectContaining({ command: 'npm test', maxRetries: 2 }));
  });

  // An approval stage legitimately has no command, and maxRetries is NOT NULL.
  it('defaults a missing command to null and missing retries to zero', async () => {
    await materializeStages('run-1', graph('a:approval'));

    expect(rows()[0]).toEqual(expect.objectContaining({ command: null, maxRetries: 0 }));
  });

  it('falls back to the node id when a node carries neither name nor label', async () => {
    const definition = graph('a');
    delete definition.nodes[0].data.name;

    await materializeStages('run-1', definition);

    expect(rows()[0].stageName).toBe('a');
  });

  // Directory first: a failure there leaves nothing to execute, whereas rows without a
  // workspace would each die at spawn.
  it('creates the run workspace before the rows', async () => {
    await materializeStages('run-1', graph('a'));

    expect(mkdirMock).toHaveBeenCalledWith(expect.stringContaining('run-1'), { recursive: true });
    expect(mkdirMock.mock.invocationCallOrder[0])
      .toBeLessThan(prismaMock.stageResult.createMany.mock.invocationCallOrder[0]);
  });

  it('writes nothing for a graph with no nodes', async () => {
    await materializeStages('run-1', graph(''));

    expect(rows()).toEqual([]);
  });
});

describe('the run compare-and-swaps', () => {
  it('startRunIfQueued only moves a run out of QUEUED', async () => {
    prismaMock.pipelineRun.updateMany.mockResolvedValue(updated(1));

    await startRunIfQueued('run-1');

    expect(prismaMock.pipelineRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: expect.any(Date) },
    });
  });

  it('finalizeRun only decides a run that is RUNNING', async () => {
    prismaMock.pipelineRun.updateMany.mockResolvedValue(updated(1));

    await finalizeRun('run-1', 'SUCCEEDED');

    expect(prismaMock.pipelineRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'RUNNING' }),
    }));
  });

  it('finalizeRun writes the caller’s verdict', async () => {
    prismaMock.pipelineRun.updateMany.mockResolvedValue(updated(1));

    await finalizeRun('run-1', 'FAILED');

    expect(prismaMock.pipelineRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'FAILED', finishedAt: expect.any(Date) },
    }));
  });

  it.each([
    ['won', 1, true],
    ['lost', 0, false],
  ])('reports a %s race as %s', async (_label, count, expected) => {
    prismaMock.pipelineRun.updateMany.mockResolvedValue(updated(count));

    expect(await finalizeRun('run-1', 'SUCCEEDED')).toBe(expected);
  });
});

describe('the stage compare-and-swaps', () => {
  beforeEach(() => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(1));
  });

  const where = () => prismaMock.stageResult.updateMany.mock.calls[0][0].where;

  // The guard status is the whole mechanism. Each of these pins the one status its
  // function is allowed to transition out of.
  it.each([
    ['claimStageForQueue', claimStageForQueue, 'PENDING', 'QUEUED'],
    ['claimStageForApproval', claimStageForApproval, 'PENDING', 'AWAITING_APPROVAL'],
    ['markStageRunning', markStageRunning, 'QUEUED', 'RUNNING'],
  ] as const)('%s guards on %s and writes %s', async (_label, fn, guard, next) => {
    await fn('run-1', 'a', 1);

    expect(where()).toEqual({ runId: 'run-1', stageId: 'a', attempt: 1, status: guard });
    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data)
      .toEqual(expect.objectContaining({ status: next }));
  });

  it('finishStage guards on RUNNING and addresses one attempt', async () => {
    await finishStage('run-1', 'a', 2, { status: 'SUCCEEDED', exitCode: 0, logSnippet: '' });

    expect(where()).toEqual({ runId: 'run-1', stageId: 'a', attempt: 2, status: 'RUNNING' });
  });

  // Not re-derived from exitCode: a timed-out stage is killed by a signal, which arrives
  // here as FAILED with a null exit code, and so is a stage whose secrets would not resolve.
  it('finishStage writes the caller’s verdict, the exit code and the log tail', async () => {
    await finishStage('run-1', 'a', 1, { status: 'FAILED', exitCode: null, logSnippet: 'boom' });

    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data).toEqual({
      status: 'FAILED', exitCode: null, logSnippet: 'boom', finishedAt: expect.any(Date),
    });
  });

  // Queued is not started; markStageRunning is what stamps startedAt, so the duration
  // shown on the Run Detail page measures execution rather than queue wait.
  it('claimStageForQueue does not stamp startedAt', async () => {
    await claimStageForQueue('run-1', 'a', 1);

    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data).toEqual({ status: 'QUEUED' });
  });

  /*
   * The mid-command tails execute()'s snapshot timer produces land here, and the RUNNING
   * guard is the entire reason they are safe. A snapshot is dispatched from a timer, so one
   * can still be in flight when the command exits; without the guard it would overwrite the
   * terminal row finishStage just wrote, replacing the final tail with an older, shorter one
   * and taking the timeout note with it.
   */
  it('recordStageProgress guards on RUNNING and addresses one attempt', async () => {
    await recordStageProgress('run-1', 'a', 3, 'compiling');

    expect(where()).toEqual({ runId: 'run-1', stageId: 'a', attempt: 3, status: 'RUNNING' });
  });

  // The snippet and nothing else. Writing status or finishedAt from a progress update would
  // enter it into a race over the fields that decide the run's outcome.
  it('recordStageProgress writes the tail alone', async () => {
    await recordStageProgress('run-1', 'a', 1, 'compiling');

    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data).toEqual({ logSnippet: 'compiling' });
  });

  // Not an error: the stage finished while this tail was in flight, so it is simply stale.
  it('recordStageProgress reports a snapshot that arrived too late', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(0));

    expect(await recordStageProgress('run-1', 'a', 1, 'stale')).toBe(false);
  });

  it.each([
    ['won', 1, true],
    ['lost', 0, false],
  ])('reports a %s claim as %s', async (_label, count, expected) => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(count));

    expect(await claimStageForQueue('run-1', 'a', 1)).toBe(expected);
  });
});

describe('cancelPendingAwaitingQueuedStages', () => {
  /*
   * Deliberately not RUNNING: that row has a command and a process behind it, and only the
   * stage worker that owns them can write its real outcome.
   *
   * AWAITING_APPROVAL belongs with PENDING for the same reason RUNNING is excluded —
   * nothing is executing, so the row can simply be closed. Leaving it out strands the
   * approval in getApprovals' queue after the run it gates has already failed, with its
   * card offering a decision that can no longer change anything.
   *
   * QUEUED is what let a retry outlive its run: advanceRun claims a fresh retry row to
   * QUEUED and enqueues it while the run is still RUNNING, and a sibling exhausting its
   * budget a second later finalizes the run over the top. Sweeping the row here is what
   * makes the job already sitting in Redis a no-op — markStageRunning guards on QUEUED,
   * so it loses its compare-and-swap and processStage returns without running anything.
   */
  it('sweeps the PENDING, QUEUED and AWAITING_APPROVAL rows of one run', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(2));

    await cancelPendingAwaitingQueuedStages('run-1');

    expect(prismaMock.stageResult.updateMany).toHaveBeenCalledWith({
      where: { runId: 'run-1', status: { in: ['PENDING', 'AWAITING_APPROVAL', 'QUEUED'] } },
      data: { status: 'CANCELLED' },
    });
  });

  // A count, not a boolean: more than one row legitimately matches here.
  it('reports how many rows it cancelled', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(3));

    expect(await cancelPendingAwaitingQueuedStages('run-1')).toBe(3);
  });
});

describe('openRetry', () => {
  const failedRow = (over: Record<string, unknown> = {}) => ({
    id: 'row-1', runId: 'run-1', stageId: 'a', attempt: 1, maxRetries: 2,
    stageName: 'build', stageType: 'CUSTOM', command: 'npm ci', status: 'RUNNING',
    ...over,
  });

  const call = () => prismaMock.pipelineRun.update.mock.calls[0][0];
  const opened = () => (call().data.stages as { create: Record<string, unknown> }).create;

  beforeEach(() => {
    prismaMock.stageResult.findFirst.mockResolvedValue(failedRow() as never);
    prismaMock.pipelineRun.update.mockResolvedValue({} as never);
  });

  /*
   * The retry is opened while the attempt is still RUNNING — before it is written FAILED,
   * so no reader ever sees a failure-terminal status for a stage that is about to try
   * again. See the ordering note in stageProcessor.processStage. The guard is what says
   * this caller still owns the attempt: a row already resolved by someone else must not be
   * handed another go.
   *
   * The run's status is read here too, but only as an early-out — the guard that actually
   * holds is the one on the write below.
   */
  it('only retries an attempt this caller still owns, on a run still running', async () => {
    await openRetry('run-1', 'a', 1);

    expect(prismaMock.stageResult.findFirst).toHaveBeenCalledWith({
      where: { runId: 'run-1', stageId: 'a', attempt: 1, status: 'RUNNING', run: { status: 'RUNNING' } },
    });
  });

  /*
   * The reason the insert goes through pipelineRun.update at all, and the regression test
   * for the bug that put it there: two stages finishing a second apart, the first opening
   * a retry while the second finalizes the run FAILED over the top, leaving a PENDING row
   * that advanceRun will never dispatch because the run is no longer RUNNING.
   *
   * Naming the status in the same statement as the insert is what closes that — reading it
   * first and inserting second leaves a window a sibling can land in. Drop this from the
   * where clause and every test below still passes.
   */
  it('makes the run still being RUNNING part of the insert itself', async () => {
    await openRetry('run-1', 'a', 1);

    expect(call().where).toEqual({ id: 'run-1', status: 'RUNNING' });
    expect(prismaMock.stageResult.create).not.toHaveBeenCalled();
  });

  // A new row rather than a mutation: the failed attempt keeps its own exit code and log
  // tail, which is the only record of why the stage needed retrying at all.
  it('writes the next attempt as a fresh PENDING row', async () => {
    await openRetry('run-1', 'a', 1);

    expect(opened()).toEqual(expect.objectContaining({
      stageId: 'a', attempt: 2, status: 'PENDING',
    }));
  });

  // The nested create takes runId from the run being updated. Passing it explicitly is a
  // type error, and this is the line that says so on purpose rather than by omission.
  it('leaves runId to the relation rather than setting it', async () => {
    await openRetry('run-1', 'a', 1);

    expect(opened()).not.toHaveProperty('runId');
  });

  // Copied from the row, not re-read from the graph: the row is what materializeStages
  // pinned when the run started, and the definition may have been edited since.
  it('carries the denormalized columns over from the failed attempt', async () => {
    await openRetry('run-1', 'a', 1);

    expect(opened()).toEqual(expect.objectContaining({
      stageName: 'build', stageType: 'CUSTOM', command: 'npm ci', maxRetries: 2,
    }));
  });

  /*
   * maxRetries is retries *after* the first try, so maxRetries 2 permits attempts 1, 2
   * and 3. Off-by-one here is invisible in normal operation and only shows up as a stage
   * that quietly gets one go too many or one too few.
   */
  it.each([
    ['after the first failure of a stage allowed two retries', 1, 2, true],
    ['after the second failure of a stage allowed two retries', 2, 2, true],
    ['once the last permitted attempt has failed', 3, 2, false],
    ['for a stage configured with no retries at all', 1, 0, false],
  ])('opens a retry %s: %s', async (_label, failedAttempt, maxRetries, expected) => {
    prismaMock.stageResult.findFirst.mockResolvedValue(failedRow({ attempt: failedAttempt, maxRetries }) as never);

    expect(await openRetry('run-1', 'a', failedAttempt)).toBe(expected);
  });

  it('writes nothing once the budget is spent', async () => {
    prismaMock.stageResult.findFirst.mockResolvedValue(failedRow({ maxRetries: 0 }) as never);

    await openRetry('run-1', 'a', 1);

    expect(prismaMock.pipelineRun.update).not.toHaveBeenCalled();
  });

  // Either the run was deleted mid-flight and cascaded, or this caller no longer owns the
  // attempt, or the run is no longer RUNNING. Nothing to retry and nothing to report.
  it('does nothing when the attempt is not there to retry', async () => {
    prismaMock.stageResult.findFirst.mockResolvedValue(null as never);

    expect(await openRetry('run-1', 'a', 1)).toBe(false);
    expect(prismaMock.pipelineRun.update).not.toHaveBeenCalled();
  });

  /*
   * The insert is the compare-and-swap for retries: @@unique([runId, stageId, attempt])
   * means two callers racing to open attempt 2 produce one row and one P2002. Treating
   * that as an error would fail the job and retry the whole processor; treating it as a
   * lost race is the same ownership signal every updateMany in this file returns.
   *
   * P2025 is the same signal from the other guard: the run stopped being RUNNING between
   * the read and the write, which is precisely the race the where clause exists to lose.
   */
  it.each([
    ['the retry already exists', 'P2002'],
    ['the run finalized between the read and the write', 'P2025'],
  ])('reports a lost race rather than throwing when %s', async (_label, code) => {
    prismaMock.pipelineRun.update.mockRejectedValue(prismaError(code));

    expect(await openRetry('run-1', 'a', 1)).toBe(false);
  });

  // Only P2002 and P2025 are ownership signals. Anything else is a real fault and must
  // reach the worker, or a broken database looks exactly like a spent retry budget.
  it('rethrows any other Prisma failure', async () => {
    prismaMock.pipelineRun.update.mockRejectedValue(prismaError('P2003'));

    await expect(openRetry('run-1', 'a', 1)).rejects.toThrow();
  });
});

describe('the boot reaper queries', () => {
  const reaperSql = () => (prismaMock.$executeRaw.mock.calls[0][0] as unknown as string[]).join('?');

  /*
   * Raw SQL has to name the physical table, and the model name is not it: @@map in
   * schema.prisma makes StageResult live in `stage_results`. Nothing else in the unit tier
   * can catch this, because Prisma is mocked and a wrong name only fails against a real
   * database -- at boot, in the recovery path, which is the worst place to find out.
   */
  it('addresses the mapped table name rather than the model name', async () => {
    prismaMock.$executeRaw.mockResolvedValue(0 as never);

    await reapStaleStages();

    expect(reaperSql()).toContain('"stage_results"');
  });

  it('reports nothing reaped on a clean boot', async () => {
    prismaMock.$executeRaw.mockResolvedValue(0 as never);

    expect(await reapStaleStages()).toBe(0);
  });

  /*
   * One statement, and the whole selection lives in its WHERE.
   *
   * RUNNING and nothing else: a QUEUED row's BullMQ job survives in Redis and is delivered
   * on restart, so reaping it would fail a stage that was about to run correctly.
   *
   * And one statement rather than a read plus a write per row. READ COMMITTED snapshots at
   * statement start, so a row that turns RUNNING later is never visited, and a row moved off
   * RUNNING concurrently has the WHERE re-evaluated before it is locked. Splitting this into
   * a findMany and N updates is the regression the call counts pin.
   */
  it('sweeps every RUNNING row, and only those, in a single statement', async () => {
    prismaMock.$executeRaw.mockResolvedValue(2 as never);

    expect(await reapStaleStages()).toBe(2);

    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.stageResult.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.stageResult.findMany).not.toHaveBeenCalled();
    expect(reaperSql()).toContain("'RUNNING'");
  });

  // logSnippet is the only place the person looking at the failed run will see a reason.
  // Without it the stage reads as a command that failed, rather than one that never
  // reported back.
  it('explains itself in the log snippet', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1 as never);

    await reapStaleStages();

    expect(String(prismaMock.$executeRaw.mock.calls[0][1])).toContain('runner');
  });

  /*
   * Appends rather than assigns, and that is the whole reason recordStageProgress exists.
   * Those snapshots were saved every couple of seconds so the stage's output would survive
   * the process dying; overwriting the column here would throw away the only record of how
   * far the command actually got, on exactly the rows someone opens the run to read.
   */
  it('keeps whatever the stage had already printed', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1 as never);

    await reapStaleStages();

    expect(reaperSql()).toContain('"logSnippet" ||');
  });

  /*
   * QUEUED as well as RUNNING. processRun sets RUNNING only after materializeStages, so a
   * death in that window leaves a run QUEUED with no stages and a BullMQ job that
   * maxStalledCount: 0 has since failed — stranded exactly like a RUNNING one, and invisible
   * to a reaper that only looked for RUNNING.
   */
  it('findUnfinishedRuns covers queued runs as well as running ones', async () => {
    prismaMock.pipelineRun.findMany.mockResolvedValue([{ id: 'run-1', status: 'QUEUED' }] as never);

    expect(await findUnfinishedRuns()).toEqual([{ id: 'run-1', status: 'QUEUED' }]);
    expect(prismaMock.pipelineRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
    }));
  });

  // The reaper builds a BullMQ job id out of exactly these three, so a select that drops one
  // addresses a different attempt's job, or none — which the sweep reads as "never enqueued".
  it('findQueuedStages selects the three fields the job id is built from', async () => {
    prismaMock.stageResult.findMany.mockResolvedValue([] as never);

    await findQueuedStages();

    expect(prismaMock.stageResult.findMany).toHaveBeenCalledWith({
      where: { status: 'QUEUED' },
      select: { stageId: true, runId: true, attempt: true },
    });
  });

  // openRetry addresses an attempt by exactly these three, and reads maxRetries off the row
  // itself — so the select stays narrow here rather than duplicating the budget lookup.
  it('findRunningStages selects the three fields openRetry addresses', async () => {
    prismaMock.stageResult.findMany.mockResolvedValue([] as never);

    await findRunningStages();

    expect(prismaMock.stageResult.findMany).toHaveBeenCalledWith({
      where: { status: 'RUNNING' },
      select: { stageId: true, runId: true, attempt: true },
    });
  });

  /*
   * Both of these are compare-and-swaps like every other write in this file, and the QUEUED
   * guard is the whole of it. Without it the reaper would overwrite a row that had moved on
   * — the sweep runs before the workers start, but the row it read may already have been
   * decided by the run pass, and a stage reset from RUNNING back to PENDING would be
   * executed twice.
   */
  it.each([
    ['updateQueuedToPending', () => updateQueuedToPending('run-1', 'a', 2), 'PENDING'],
    ['failQueuedStage', () => failQueuedStage('run-1', 'a', 2), 'FAILED'],
  ])('%s guards on QUEUED and addresses one attempt', async (_label, call, status) => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(1));

    await call();

    const [{ where, data }] = prismaMock.stageResult.updateMany.mock.calls[0];
    expect(where).toEqual({ runId: 'run-1', stageId: 'a', attempt: 2, status: 'QUEUED' });
    expect(data).toEqual(expect.objectContaining({ status }));
  });

  // A stage failed this way never ran at all, so the snippet is the only thing standing
  // between the reader and a stage that appears to have failed for no reason.
  it('failQueuedStage explains itself in the log snippet', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(1));

    await failQueuedStage('run-1', 'a', 1);

    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ logSnippet: expect.stringContaining('queued'), finishedAt: expect.any(Date) }),
    );
  });
});

describe('isRunCancelled', () => {
  const runStatus = (status: string | null) =>
    prismaMock.pipelineRun.findUnique.mockResolvedValue(
      status === null ? null : { status } as never,
    );

  it('reads only the status, off the run id', async () => {
    runStatus('RUNNING');

    await isRunCancelled('run-1');

    expect(prismaMock.pipelineRun.findUnique).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      select: { status: true },
    });
  });

  it.each(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'])('reports false for %s', async (status) => {
    runStatus(status);

    expect(await isRunCancelled('run-1')).toBe(false);
  });

  it('reports true for CANCELLED', async () => {
    runStatus('CANCELLED');

    expect(await isRunCancelled('run-1')).toBe(true);
  });

  // The row went with the run by cascade, and processStage's own loadRunContext guard is
  // what handles that. Reporting a deletion as a cancellation would kill the command for
  // the wrong reason and write a note that is not true.
  it('reports false for a run that no longer exists', async () => {
    runStatus(null);

    expect(await isRunCancelled('run-1')).toBe(false);
  });
});

describe('cancelOrphanedStages', () => {
  /*
   * Every non-terminal status, filtered by the *run's* status rather than the stage's own.
   * RUNNING belongs here even though cancelRun deliberately leaves it alone: this pass only
   * ever sees a row the runner abandoned, since a live runner writes it itself.
   */
  it('closes out every unfinished stage of a cancelled run', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(4));

    await cancelOrphanedStages();

    expect(prismaMock.stageResult.updateMany).toHaveBeenCalledWith({
      where: {
        run: { status: 'CANCELLED' },
        status: { in: ['PENDING', 'QUEUED', 'RUNNING', 'AWAITING_APPROVAL'] },
      },
      data: { status: 'CANCELLED', finishedAt: expect.any(Date) },
    });
  });

  it('reports how many rows it closed', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(4));

    expect(await cancelOrphanedStages()).toBe(4);
  });
});
