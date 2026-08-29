import { getApprovals } from '@/lib/data/approvals';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import type { StageStatus as PrismaStageStatus } from '@/generated/prisma';

/*
 * getApprovals is a read plus two translations. The interesting one is stagesComplete:
 * a retry is a new StageResult row rather than an update, so the rows for a run are
 * per-attempt, and counting them directly reports a three-stage run as "1/5". The fold
 * that collapses them is only correct because the query asks for ascending attempts, and
 * with Prisma mocked nothing here executes SQL — so the ordering is asserted as a call
 * argument, and every fold case feeds its rows in the order a real query would.
 *
 * The other is commitMessage, a field PipelineRun does not store: it is dug out of the
 * payload of whichever WebhookEvent points at the run, if any. runNumber used to be
 * derived the same way — one count() per run — and is now a column on PipelineRun.
 */
jest.mock('@/lib/prisma');

beforeEach(resetPrismaMock);

const stage = (stageId: string, status: PrismaStageStatus, attempt = 1) => ({
  id: `${stageId}-${attempt}`,
  runId: 'r1',
  stageId,
  stageName: stageId,
  stageType: 'CUSTOM' as const,
  status,
  attempt,
  maxRetries: 2,
  exitCode: null,
  logSnippet: null,
  command: 'npm test',
  approvedById: null,
  approvedAt: null,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  finishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const run = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  pipelineId: 'p1',
  definitionId: 'd1',
  status: 'RUNNING' as const,
  trigger: 'MANUAL' as const,
  commitSha: 'abc123',
  branch: 'main',
  triggeredById: 'u1',
  environmentId: 'e1',
  startedAt: new Date('2026-01-01T00:00:00Z'),
  finishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  runNumber: 7,
  pipeline: { name: 'Deploy API' },
  environment: { type: 'PRODUCTION', name: 'prod-us-east' },
  triggeredBy: { name: 'kyle' },
  stages: [],
  ...over,
});

const approval = (over: Record<string, unknown> = {}) => ({
  ...stage('deploy', 'AWAITING_APPROVAL'),
  id: 'sr-1',
  stageType: 'APPROVAL' as const,
  run: run(),
  ...over,
});

/** One approval, no webhook deliveries — the shape most cases only need one field of. */
const only = async (over: Record<string, unknown> = {}) => {
  prismaMock.stageResult.findMany.mockResolvedValue([approval(over)] as never);
  prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);

  return (await getApprovals())[0];
};

/** Rows arrive [stageId asc, attempt asc], which is what the query asks the database for. */
const withStages = async (...stages: ReturnType<typeof stage>[]) =>
  (await only({ run: run({ stages }) })).stagesComplete;

describe('stagesComplete', () => {
  it('counts a stage once however many attempts it has', async () => {
    expect(
      await withStages(
        stage('build', 'SUCCEEDED'),
        stage('test', 'FAILED', 1),
        stage('test', 'FAILED', 2),
        stage('test', 'RUNNING', 3),
        stage('deploy', 'PENDING'),
      ),
    ).toBe('1/3');
  });

  it('reports a stage that succeeded on retry as complete', async () => {
    expect(
      await withStages(stage('test', 'FAILED', 1), stage('test', 'SUCCEEDED', 2)),
    ).toBe('1/1');
  });

  /*
   * Not reachable through the runner, which only opens a retry on failure — but it is the
   * case that separates the fold this uses (last attempt wins) from an "any attempt
   * succeeded" count, and last-write-wins is the whole reason the query orders by attempt.
   */
  it('reads the newest attempt rather than the best one', async () => {
    expect(
      await withStages(stage('test', 'SUCCEEDED', 1), stage('test', 'RUNNING', 2)),
    ).toBe('0/1');
  });

  it('counts a run whose stages have all succeeded as whole', async () => {
    expect(
      await withStages(stage('build', 'SUCCEEDED'), stage('test', 'SUCCEEDED')),
    ).toBe('2/2');
  });

  it('counts no stage that is still in flight', async () => {
    expect(
      await withStages(stage('build', 'RUNNING'), stage('test', 'PENDING')),
    ).toBe('0/2');
  });

  // The approval stage itself is one of the run's stages, so it is part of the denominator.
  it('counts the awaiting-approval stage among the total', async () => {
    expect(
      await withStages(stage('build', 'SUCCEEDED'), stage('deploy', 'AWAITING_APPROVAL')),
    ).toBe('1/2');
  });

  /*
   * An approval stage never reaches SUCCEEDED — it is never executed, so nothing ever
   * exits zero for it. lib/actions/approvals.ts writes APPROVED instead, which is that
   * stage's own terminal success and has to count as one, or a run gated on an approval
   * could never read as whole however far it got.
   */
  it('counts an approved stage as complete', async () => {
    expect(
      await withStages(stage('build', 'SUCCEEDED'), stage('deploy', 'APPROVED')),
    ).toBe('2/2');
  });

  it('counts an approved stage the same as an executed one', async () => {
    expect(
      await withStages(stage('gate-a', 'APPROVED'), stage('gate-b', 'APPROVED')),
    ).toBe('2/2');
  });

  // UNAPPROVED is the other terminal answer, and it is a refusal rather than progress.
  it('does not count a stage that was refused', async () => {
    expect(
      await withStages(stage('build', 'SUCCEEDED'), stage('deploy', 'UNAPPROVED')),
    ).toBe('1/2');
  });

  it('reports zero of zero for a run with no stage rows yet', async () => {
    expect(await withStages()).toBe('0/0');
  });
});

describe('the query it issues', () => {
  const call = () => prismaMock.stageResult.findMany.mock.calls[0][0];

  beforeEach(async () => {
    prismaMock.stageResult.findMany.mockResolvedValue([] as never);
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);
    await getApprovals();
  });

  it('asks only for approval stages that are still waiting', () => {
    expect(call()).toMatchObject({
      where: { stageType: 'APPROVAL', status: 'AWAITING_APPROVAL' },
    });
  });

  it('puts the longest-waiting approval first', () => {
    expect(call()).toMatchObject({ orderBy: { createdAt: 'asc' } });
  });

  /*
   * Load-bearing, and the one thing the mocked tier can say about it: the fold above is
   * last-write-wins, so ascending attempt is what makes "last" mean "latest attempt".
   * Drop this and every stagesComplete case still passes on its fixtures, while real rows
   * arrive in whatever order Postgres feels like returning them.
   */
  it('asks for each run stage list by ascending attempt', () => {
    expect(call()).toMatchObject({
      include: {
        run: {
          include: {
            stages: { orderBy: [{ stageId: 'asc' }, { attempt: 'asc' }] },
          },
        },
      },
    });
  });
});

describe('commitMessage', () => {
  const withEvents = async (events: Record<string, unknown>[], approvals = [approval()]) => {
    prismaMock.stageResult.findMany.mockResolvedValue(approvals as never);
    prismaMock.webhookEvent.findMany.mockResolvedValue(events as never);

    return getApprovals();
  };

  it('recovers the message from the delivery that triggered the run', async () => {
    const [row] = await withEvents([
      { runId: 'r1', payload: { head_commit: { message: 'fix the thing' } } },
    ]);

    expect(row.commitMessage).toBe('fix the thing');
  });

  // A manually triggered run has no delivery at all, which is the common case.
  it('is null when no delivery points at the run', async () => {
    const [row] = await withEvents([]);

    expect(row.commitMessage).toBeNull();
  });

  // A pull_request delivery carries no head_commit, and a delivery can be stored
  // before it is understood.
  it('is null when the payload carries no commit', async () => {
    const [row] = await withEvents([{ runId: 'r1', payload: { action: 'opened' } }]);

    expect(row.commitMessage).toBeNull();
  });

  it('does not borrow a message from a different run', async () => {
    const [row] = await withEvents([
      { runId: 'r2', payload: { head_commit: { message: 'someone else' } } },
    ]);

    expect(row.commitMessage).toBeNull();
  });

  // One query for every run on the page rather than one per approval.
  it('looks up every run in a single query', async () => {
    await withEvents(
      [],
      [approval({ id: 'sr-1' }), approval({ id: 'sr-2', runId: 'r2', run: run({ id: 'r2' }) })],
    );

    expect(prismaMock.webhookEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.webhookEvent.findMany).toHaveBeenCalledWith({
      where: { runId: { in: ['r1', 'r2'] } },
    });
  });
});

/*
 * PipelineRun has no number column, so a run's number is derived: how many runs of the
 * same pipeline existed at or before it was created. That costs one count() per run,
 * which is why they are batched and why the run list is de-duplicated first — a fan-out
 * graph can leave several stages of one run waiting at once.
 */
describe('runNumber', () => {
  it('reads the number off the run row', async () => {
    const row = await only();

    expect(row.runNumber).toBe(7);
    // The column replaced a count() per run — no such query should be issued.
    expect(prismaMock.pipelineRun.count).not.toHaveBeenCalled();
  });

  it('gives every approval on one run the same number', async () => {
    prismaMock.stageResult.findMany.mockResolvedValue(
      [approval({ id: 'sr-1' }), approval({ id: 'sr-2' })] as never,
    );
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);

    const rows = await getApprovals();

    expect(rows.map((row) => row.runNumber)).toEqual([7, 7]);
  });

  it('carries each run its own number', async () => {
    prismaMock.stageResult.findMany.mockResolvedValue([
      approval({ id: 'sr-1' }),
      approval({ id: 'sr-2', runId: 'r2', run: run({ id: 'r2', runNumber: 9 }) }),
    ] as never);
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);

    const rows = await getApprovals();

    expect(rows.map((row) => row.runNumber)).toEqual([7, 9]);
  });
});

describe('the flattened row', () => {
  it('carries the run identity rather than its nested objects', async () => {
    expect(await only()).toMatchObject({
      id: 'sr-1',
      stageId: 'deploy',
      runId: 'r1',
      pipelineName: 'Deploy API',
      createdBy: 'kyle',
      commitSha: 'abc123',
      branch: 'main',
    });
  });

  it('lowercases the environment type into the one the UI types use', async () => {
    expect((await only()).environment).toEqual({ type: 'production', name: 'prod-us-east' });
  });

  // environmentId is optional on PipelineRun, and a run without one is legal.
  it('reports no environment rather than a half-built one', async () => {
    expect((await only({ run: run({ environment: null, environmentId: null }) })).environment)
      .toBeNull();
  });

  // triggeredById is optional too: a run outliving the user who started it is real.
  it('reports no author when the run has no triggering user', async () => {
    expect((await only({ run: run({ triggeredBy: null, triggeredById: null }) })).createdBy)
      .toBeNull();
  });

  it('tolerates a run with no commit context', async () => {
    const row = await only({ run: run({ commitSha: null, branch: null }) });

    expect(row).toMatchObject({ commitSha: null, branch: null });
  });

  it('returns nothing when no approval is waiting', async () => {
    prismaMock.stageResult.findMany.mockResolvedValue([] as never);
    prismaMock.webhookEvent.findMany.mockResolvedValue([] as never);

    await expect(getApprovals()).resolves.toEqual([]);
  });
});

describe('waitingTime', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-01-01T02:30:00Z')));
  afterEach(() => jest.useRealTimers());

  it('measures from the moment the stage began waiting', async () => {
    const row = await only({ startedAt: new Date('2026-01-01T00:00:00Z') });

    expect(row.waitingTime).toBe('2h 30m');
  });

  /*
   * A stage the runner has not reached yet has no startedAt. Falling back to createdAt
   * keeps the column honest rather than measuring from the epoch.
   */
  it('falls back to when the row was written if it never started', async () => {
    const row = await only({
      startedAt: null,
      createdAt: new Date('2026-01-01T02:00:00Z'),
    });

    expect(row.waitingTime).toBe('30m');
  });
});
