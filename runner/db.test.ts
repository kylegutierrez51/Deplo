import {
  loadRunContext, materializeStages, startRunIfQueued, claimStageForQueue,
  claimStageForApproval, markStageRunning, finishStage, finalizeRun, cancelPendingStages,
} from './db';
import { graph } from '@/test/helpers/graph';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
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
    await finishStage('run-1', 'a', 2, 'SUCCEEDED', 0);

    expect(where()).toEqual({ runId: 'run-1', stageId: 'a', attempt: 2, status: 'RUNNING' });
  });

  // Not re-derived from exitCode: Phase 4 kills a timed-out stage with a signal, which
  // arrives here as FAILED with a null exit code.
  it('finishStage writes the caller’s verdict and the exit code', async () => {
    await finishStage('run-1', 'a', 1, 'FAILED', null);

    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data).toEqual({
      status: 'FAILED', exitCode: null, finishedAt: expect.any(Date),
    });
  });

  // Queued is not started; markStageRunning is what stamps startedAt, so the duration
  // shown on the Run Detail page measures execution rather than queue wait.
  it('claimStageForQueue does not stamp startedAt', async () => {
    await claimStageForQueue('run-1', 'a', 1);

    expect(prismaMock.stageResult.updateMany.mock.calls[0][0].data).toEqual({ status: 'QUEUED' });
  });

  it.each([
    ['won', 1, true],
    ['lost', 0, false],
  ])('reports a %s claim as %s', async (_label, count, expected) => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(count));

    expect(await claimStageForQueue('run-1', 'a', 1)).toBe(expected);
  });
});

describe('cancelPendingStages', () => {
  // Deliberately not QUEUED or RUNNING: those stages cannot actually be stopped without
  // a cancel mechanism, and recording them as CANCELLED would be a lie.
  it('sweeps only the PENDING rows of one run', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(2));

    await cancelPendingStages('run-1');

    expect(prismaMock.stageResult.updateMany).toHaveBeenCalledWith({
      where: { runId: 'run-1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });

  // A count, not a boolean: more than one row legitimately matches here.
  it('reports how many rows it cancelled', async () => {
    prismaMock.stageResult.updateMany.mockResolvedValue(updated(3));

    expect(await cancelPendingStages('run-1')).toBe(3);
  });
});
