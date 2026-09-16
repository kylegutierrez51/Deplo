import { getDashboardData } from '@/lib/data/dashboard';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import type { RunStatus as PrismaRunStatus } from '@/generated/prisma';

/*
 * getDashboardData is eight queries fired in one Promise.all, then arithmetic over
 * their results. The queries themselves are Prisma's business; what is worth pinning
 * is everything derived from them, because each derivation has a degenerate input the
 * page would otherwise render as nonsense:
 *
 *   - successRate divides by a total that is zero on a quiet week (NaN%)
 *   - moreApprovals subtracts a list length from a separately-issued count
 *   - a pipeline's status and last-run date are read off runs[0], which is only the
 *     newest run because the query asks for it in that order
 *
 * The parallel counts share one jest.fn per Prisma model, so the run counts are
 * stubbed by an implementation that switches on the status each call asks for rather
 * than by a mockResolvedValueOnce chain — which would silently pair the wrong number
 * with the wrong status if the Promise.all array were ever reordered.
 */
jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

const NOW = new Date('2026-09-16T12:00:00Z');
const WEEK_AGO = new Date('2026-09-09T12:00:00Z');

const run = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  pipelineId: 'p1',
  definitionId: 'd1',
  status: 'SUCCEEDED' as const,
  trigger: 'MANUAL' as const,
  runNumber: 7,
  commitSha: 'abc1234def',
  branch: 'main',
  triggeredById: 'u1',
  environmentId: 'e1',
  startedAt: new Date('2026-09-16T10:00:00Z'),
  finishedAt: new Date('2026-09-16T10:05:00Z'),
  createdAt: new Date('2026-09-16T09:59:00Z'),
  pipeline: { name: 'Deploy API' },
  environment: { name: 'prod-us-east', type: 'PRODUCTION' },
  ...over,
});

const approval = (over: Record<string, unknown> = {}) => ({
  id: 'sr-1',
  runId: 'r1',
  stageId: 'deploy',
  stageType: 'APPROVAL' as const,
  status: 'AWAITING_APPROVAL' as const,
  createdAt: new Date('2026-09-16T11:00:00Z'),
  run: run(),
  ...over,
});

const pipeline = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Deploy API',
  description: null,
  repoUrl: null,
  createdById: 'u1',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-16T00:00:00Z'),
  runs: [],
  ...over,
});

type Fixture = {
  runCounts?: Partial<Record<PrismaRunStatus, number>>;
  awaitingApproval?: number;
  recentRuns?: Record<string, unknown>[];
  approvals?: Record<string, unknown>[];
  pipelines?: Record<string, unknown>[];
};

const load = (fixture: Fixture = {}) => {
  prismaMock.pipelineRun.count.mockImplementation(
    ((args: { where: { status: PrismaRunStatus } }) =>
      Promise.resolve(fixture.runCounts?.[args.where.status] ?? 0)) as never,
  );
  prismaMock.stageResult.count.mockResolvedValue((fixture.awaitingApproval ?? 0) as never);
  prismaMock.pipelineRun.findMany.mockResolvedValue((fixture.recentRuns ?? []) as never);
  prismaMock.stageResult.findMany.mockResolvedValue((fixture.approvals ?? []) as never);
  prismaMock.pipeline.findMany.mockResolvedValue((fixture.pipelines ?? []) as never);

  return getDashboardData();
};

/** The week's arithmetic, given how many runs succeeded and failed inside the window. */
const week = async (SUCCEEDED: number, FAILED: number) =>
  (await load({ runCounts: { SUCCEEDED, FAILED } })).week;

describe('the seven-day window', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  const whereFor = (status: PrismaRunStatus) =>
    prismaMock.pipelineRun.count.mock.calls
      .map(([args]) => args as { where: Record<string, unknown> })
      .find((args) => args.where.status === status)!.where;

  it('measures the window from seven days before now', async () => {
    await load();

    expect(whereFor('SUCCEEDED')).toEqual({ status: 'SUCCEEDED', createdAt: { gte: WEEK_AGO } });
    expect(whereFor('FAILED')).toEqual({ status: 'FAILED', createdAt: { gte: WEEK_AGO } });
  });

  /*
   * Deliberately not windowed, and the contrast is the point: "failed" is a
   * rate-of-recent-breakage number, while "running" and "queued" are a statement
   * about right now. A run that queued eight days ago and never moved is still
   * occupying the queue, and windowing it would hide the one run most worth seeing.
   */
  it('leaves the running and queued counts unbounded by it', async () => {
    await load();

    expect(whereFor('RUNNING')).toEqual({ status: 'RUNNING' });
    expect(whereFor('QUEUED')).toEqual({ status: 'QUEUED' });
  });
});

describe('successRate', () => {
  /*
   * The guard on a divide by zero. Without it a week with nothing finished yields
   * 0/0 — NaN — and the page renders "NaN%" behind a meter whose width is "NaN%".
   * null is a distinct answer from 0, and the page branches on it to say so.
   */
  it('is null when nothing finished this week', async () => {
    expect((await week(0, 0)).successRate).toBeNull();
  });

  it('rounds to a whole percent', async () => {
    expect((await week(2, 1)).successRate).toBe(67);
    expect((await week(1, 2)).successRate).toBe(33);
  });

  it('reports a clean week as a hundred', async () => {
    expect((await week(4, 0)).successRate).toBe(100);
  });

  it('reports a week with no successes as zero rather than null', async () => {
    expect((await week(0, 3)).successRate).toBe(0);
  });

  /*
   * finished is succeeded + failed, not every run created in the window. A cancelled
   * run is a decision someone made rather than a failure, and a queued or running one
   * has not had its say yet — counting either in the denominator would drag the rate
   * down for runs that never lost.
   */
  it('counts only the runs that reached a verdict', async () => {
    const result = await week(3, 1);

    expect(result).toMatchObject({ succeeded: 3, failed: 1, finished: 4, successRate: 75 });
  });

  it('ignores cancelled and in-flight runs in the denominator', async () => {
    const { week: result } = await load({
      runCounts: { SUCCEEDED: 1, FAILED: 1, CANCELLED: 10, RUNNING: 10, QUEUED: 10 },
    });

    expect(result).toMatchObject({ finished: 2, successRate: 50 });
  });
});

describe('the counts the stat cards read', () => {
  it('carries the four the page displays', async () => {
    const { counts } = await load({
      runCounts: { RUNNING: 2, QUEUED: 5, FAILED: 3 },
      awaitingApproval: 4,
    });

    expect(counts).toEqual({ running: 2, queued: 5, awaitingApproval: 4, failed7d: 3 });
  });
});

describe('moreApprovals', () => {
  const waiting = async (total: number, listed: number) =>
    (await load({
      awaitingApproval: total,
      approvals: Array.from({ length: listed }, (_, i) => approval({ id: `sr-${i}` })),
    })).moreApprovals;

  it('reports the waiting approvals the list left out', async () => {
    expect(await waiting(11, 4)).toBe(7);
  });

  it('is zero when the list holds everything waiting', async () => {
    expect(await waiting(3, 3)).toBe(0);
  });

  /*
   * The count and the list are separate queries issued in one Promise.all, so they
   * are two reads rather than one snapshot: an approval decided between them leaves
   * the count lower than the list it is being subtracted from. The clamp is what
   * stops the page rendering "+-1 more waiting"; without it the negative is not an
   * error anywhere, it just prints.
   */
  it('never goes negative when the count trails the list', async () => {
    expect(await waiting(2, 4)).toBe(0);
  });

  it('is zero when nothing is waiting at all', async () => {
    expect(await waiting(0, 0)).toBe(0);
  });
});

describe('recentRuns', () => {
  const only = async (over: Record<string, unknown> = {}) =>
    (await load({ recentRuns: [run(over)] })).recentRuns[0];

  it('flattens the run onto the shape the row renders', async () => {
    expect(await only()).toMatchObject({
      id: 'r1',
      pipelineName: 'Deploy API',
      status: 'succeeded',
      trigger: 'manual',
      branch: 'main',
      commitSha: 'abc1234def',
    });
  });

  it('lowercases every status into the one the Pill variants use', async () => {
    const statuses: PrismaRunStatus[] = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'];
    const rows = await load({
      recentRuns: statuses.map((status, i) => run({ id: `r${i}`, status })),
    });

    expect(rows.recentRuns.map((row) => row.status))
      .toEqual(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
  });

  it('lowercases the trigger the same way', async () => {
    expect((await only({ trigger: 'WEBHOOK' })).trigger).toBe('webhook');
  });

  it('lowercases the environment type', async () => {
    expect((await only()).environment).toEqual({ name: 'prod-us-east', type: 'production' });
  });

  // environmentId is optional on PipelineRun, and a run without one is legal.
  it('reports no environment rather than a half-built one', async () => {
    expect((await only({ environment: null, environmentId: null })).environment).toBeNull();
  });

  // A manually triggered run carries no commit context; the row renders the gap.
  it('tolerates a run with no branch or commit', async () => {
    expect(await only({ branch: null, commitSha: null }))
      .toMatchObject({ branch: null, commitSha: null });
  });

  /*
   * Not reachable: Pipeline -> PipelineRun is a required relation with onDelete:
   * Cascade, so deleting a pipeline takes its runs with it and the include can never
   * come back empty. Pinned because the mapping and the page both carry a fallback
   * for it ("Deleted pipeline"), and a reader finding that branch should be able to
   * see it is defensive rather than a case the page is known to hit.
   */
  it('names a run with no pipeline as nameless rather than throwing', async () => {
    expect((await only({ pipeline: null })).pipelineName).toBeNull();
  });

  it('returns nothing when no run exists yet', async () => {
    expect((await load()).recentRuns).toEqual([]);
  });
});

describe('approvals', () => {
  const only = async (over: Record<string, unknown> = {}) =>
    (await load({ approvals: [approval(over)], awaitingApproval: 1 })).approvals[0];

  it('flattens the stage and its run into one row', async () => {
    expect(await only()).toMatchObject({
      id: 'sr-1',
      runId: 'r1',
      pipelineName: 'Deploy API',
      environment: { name: 'prod-us-east', type: 'production' },
    });
  });

  /*
   * waitingSince is the stage row's createdAt, not the run's: the page renders it as
   * "<duration> waiting", and an approval gating the end of a long pipeline has been
   * waiting since the runner wrote the row, not since the run was triggered.
   */
  it('dates the wait from when the stage row was written', async () => {
    const row = await only({ createdAt: new Date('2026-09-16T11:00:00Z') });

    expect(row.waitingSince).toEqual(new Date('2026-09-16T11:00:00Z'));
  });

  it('reports no environment for a run that has none', async () => {
    const row = await only({ run: run({ environment: null, environmentId: null }) });

    expect(row.environment).toBeNull();
  });

  it('returns nothing when no approval is waiting', async () => {
    expect((await load()).approvals).toEqual([]);
  });
});

describe('pipelines', () => {
  const only = async (over: Record<string, unknown> = {}) =>
    (await load({ pipelines: [pipeline(over)] })).pipelines[0];

  it('takes its status from the run included with it', async () => {
    expect((await only({ runs: [run({ status: 'RUNNING' })] })).status).toBe('running');
  });

  /*
   * 'idle' has no Prisma enum counterpart — RunStatus has no member for "never ran".
   * It is invented here for a pipeline with no runs, which is every pipeline for the
   * moment between creating it and triggering it.
   */
  it('reports a pipeline that has never run as idle', async () => {
    expect((await only({ runs: [] })).status).toBe('idle');
  });

  it('dates the last run from when it finished', async () => {
    const row = await only({
      runs: [run({
        finishedAt: new Date('2026-09-16T10:05:00Z'),
        createdAt: new Date('2026-09-16T09:59:00Z'),
      })],
    });

    expect(row.lastRun).toEqual(new Date('2026-09-16T10:05:00Z'));
  });

  /*
   * A run still in flight has no finishedAt. createdAt is the fallback so the page's
   * "<duration> ago" reads as how long ago the pipeline last did something, rather
   * than collapsing to the null branch and claiming it has never run.
   */
  it('falls back to when an unfinished run was created', async () => {
    const row = await only({
      runs: [run({ status: 'RUNNING', finishedAt: null, createdAt: new Date('2026-09-16T09:59:00Z') })],
    });

    expect(row.lastRun).toEqual(new Date('2026-09-16T09:59:00Z'));
  });

  it('reports no last run for a pipeline that has never run', async () => {
    expect((await only({ runs: [] })).lastRun).toBeNull();
  });

  it('does not leak the included runs into the row', async () => {
    expect(await only({ runs: [run()] })).not.toHaveProperty('runs');
  });

  it('returns nothing when no pipeline exists', async () => {
    expect((await load()).pipelines).toEqual([]);
  });
});

describe('the queries it issues', () => {
  beforeEach(() => load());

  it('asks for the newest runs, capped at what the panel shows', () => {
    expect(prismaMock.pipelineRun.findMany.mock.calls[0][0]).toMatchObject({
      take: 8,
      orderBy: { createdAt: 'desc' },
    });
  });

  // The panel is a work queue, so the one waiting longest is the one to act on first.
  it('puts the longest-waiting approval first, capped at what the panel shows', () => {
    expect(prismaMock.stageResult.findMany.mock.calls[0][0]).toMatchObject({
      take: 4,
      orderBy: { createdAt: 'asc' },
    });
  });

  /*
   * moreApprovals subtracts the length of the list from the count, which only means
   * anything if both address the same population. Let the two filters drift and the
   * page reports a number of waiting approvals that exist nowhere.
   */
  it('counts the same approvals it lists', () => {
    const filter = { stageType: 'APPROVAL', status: 'AWAITING_APPROVAL' };

    expect(prismaMock.stageResult.count).toHaveBeenCalledWith({ where: filter });
    expect(prismaMock.stageResult.findMany.mock.calls[0][0]).toMatchObject({ where: filter });
  });

  /*
   * The only thing this tier can say about it, and the whole derivation rests on it:
   * status and lastRun are both read off runs[0], so `take: 1` ordered by descending
   * createdAt is what makes that row the *newest* run. Drop the orderBy and every
   * case above still passes on its single-run fixtures, while a real pipeline reports
   * the status of whichever run Postgres happened to return first.
   */
  it('includes only the newest run of each pipeline', () => {
    expect(prismaMock.pipeline.findMany.mock.calls[0][0]).toMatchObject({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
  });

  // Eight reads for one page: they are fired together rather than awaited in sequence.
  it('reads everything in one round of parallel queries', () => {
    expect(prismaMock.pipelineRun.count).toHaveBeenCalledTimes(4);
    expect(prismaMock.stageResult.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.pipelineRun.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.stageResult.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.pipeline.findMany).toHaveBeenCalledTimes(1);
  });
});
