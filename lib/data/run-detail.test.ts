import { countJobs, buildLogFilters, buildLogs, addNodeDetails, type StageLite } from '@/lib/data/run-detail';
import type { CustomNode } from '@/lib/types';
import type { StageStatus as PrismaStageStatus, StageResult } from '@/generated/prisma';

// The helpers under test are pure, but they live in a module that imports the
// Prisma singleton at top level, which constructs a PrismaPg adapter and pulls
// in `pg`. Without this the suite fails to load on `TextEncoder is not defined`.
jest.mock('@/lib/prisma');

/*
 * The three exported helpers here take plain data, so no stubbing is needed.
 * They drive the Run Detail header counts, the log filter dropdown and the log
 * pane respectively — all of which read from graphJson's nodes rather than from
 * StageResult rows, so the "stage row does not exist yet" case is the normal
 * state of a queued run, not an error.
 */

const node = (id: string, name = id): CustomNode => ({
  id, position: { x: 0, y: 0 }, data: { type: 'custom', name },
});

const stage = (stageId: string, status: PrismaStageStatus): StageLite => ({ stageId, status });

describe('countJobs', () => {
  it('counts every node in the graph as total, stage row or not', () => {
    const counts = countJobs([node('a'), node('b'), node('c')], []);

    expect(counts.total).toBe(3);
  });

  it.each([
    ['SUCCEEDED', 'succeeded'],
    ['RUNNING', 'running'],
    ['QUEUED', 'queued'],
    ['FAILED', 'failed'],
    ['CANCELLED', 'cancelled'],
    ['AWAITING_APPROVAL', 'awaitingApproval'],
    ['APPROVED', 'approved'],
    ['UNAPPROVED', 'unapproved'],
  ] as const)('maps %s into the %s bucket', (prismaStatus, bucket) => {
    const counts = countJobs([node('a')], [stage('a', prismaStatus)]);

    expect(counts[bucket]).toBe(1);
  });

  // A queued run has graph nodes but no StageResult rows yet, so this is the
  // ordinary starting state rather than an inconsistency.
  it('counts a node with no stage row in total only', () => {
    const counts = countJobs([node('a')], []);

    expect(counts.total).toBe(1);
    expect(counts.succeeded + counts.running + counts.queued + counts.failed).toBe(0);
  });

  // PENDING is in the Prisma enum but has no switch arm, so it lands nowhere.
  it('counts a PENDING stage in total but in no status bucket', () => {
    const counts = countJobs([node('a')], [stage('a', 'PENDING')]);

    expect(counts.total).toBe(1);
    expect(Object.entries(counts).filter(([key]) => key !== 'total').every(([, v]) => v === 0)).toBe(true);
  });

  // Stage rows are keyed by node id, so a row left over from a deleted stage
  // must not inflate the totals.
  it('ignores a stage row with no matching node', () => {
    const counts = countJobs([node('a')], [stage('a', 'SUCCEEDED'), stage('ghost', 'FAILED')]);

    expect(counts.total).toBe(1);
    expect(counts.failed).toBe(0);
  });

  it('tallies a mixed run', () => {
    const counts = countJobs(
      [node('a'), node('b'), node('c'), node('d')],
      [stage('a', 'SUCCEEDED'), stage('b', 'SUCCEEDED'), stage('c', 'RUNNING')],
    );

    expect(counts).toEqual({
      total: 4, succeeded: 2, running: 1, queued: 0, failed: 0,
      cancelled: 0, awaitingApproval: 0, approved: 0, unapproved: 0,
    });
  });

  it('returns all zeroes for an empty graph', () => {
    expect(countJobs([], [])).toEqual({
      total: 0, succeeded: 0, running: 0, queued: 0, failed: 0,
      cancelled: 0, awaitingApproval: 0, approved: 0, unapproved: 0,
    });
  });
});

describe('buildLogFilters', () => {
  it('emits one option per node in pipeline order, not stage order', () => {
    const nodes = [node('n3', 'deploy'), node('n1', 'build'), node('n2', 'test')];

    expect(buildLogFilters(nodes, []).map(f => f.value)).toEqual(['n3', 'n1', 'n2']);
  });

  it('labels an option with the stage name and its job status', () => {
    const filters = buildLogFilters([node('n1', 'build')], [stage('n1', 'SUCCEEDED')]);

    expect(filters[0]).toEqual({ value: 'n1', label: 'build - succeeded' });
  });

  it('falls back to pending when the stage has not started', () => {
    expect(buildLogFilters([node('n1', 'build')], [])[0].label).toBe('build - pending');
  });

  it('renders the hyphenated form of AWAITING_APPROVAL', () => {
    const filters = buildLogFilters([node('n1', 'gate')], [stage('n1', 'AWAITING_APPROVAL')]);

    expect(filters[0].label).toBe('gate - awaiting-approval');
  });

  // fromDefinition omits `name` entirely when it was never set, so the ?? ''
  // fallback is reachable from a real definition.
  it('renders an empty name rather than "undefined"', () => {
    const unnamed = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom' as const } };

    expect(buildLogFilters([unnamed], [])[0].label).toBe(' - pending');
  });

  it('returns no options for an empty graph', () => {
    expect(buildLogFilters([], [])).toEqual([]);
  });
});

describe('buildLogs', () => {
  const logStage = (over: Partial<Parameters<typeof buildLogs>[0][number]> = {}) => ({
    stageName: 'build',
    command: 'npm run build',
    logSnippet: 'line one\nline two',
    status: 'SUCCEEDED' as PrismaStageStatus,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    finishedAt: new Date('2026-01-01T00:00:30Z'),
    ...over,
  });

  it('builds a log entry per eligible stage', () => {
    const [log] = buildLogs([logStage()]);

    expect(log).toEqual({
      jobName: 'build',
      command: 'npm run build',
      status: 'succeeded',
      duration: '30s',
      lines: [
        { lineNumber: 1, timestamp: '', content: 'line one' },
        { lineNumber: 2, timestamp: '', content: 'line two' },
      ],
    });
  });

  it.each(['SUCCEEDED', 'FAILED', 'RUNNING'] as const)('includes a %s stage', (status) => {
    expect(buildLogs([logStage({ status })])).toHaveLength(1);
  });

  // An approval gate or a stage that never ran has nothing to show.
  it.each(['PENDING', 'QUEUED', 'AWAITING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'CANCELLED'] as const)(
    'excludes a %s stage', (status) => {
      expect(buildLogs([logStage({ status })])).toEqual([]);
    });

  it('excludes a stage with neither a command nor a snippet', () => {
    expect(buildLogs([logStage({ command: null, logSnippet: null })])).toEqual([]);
  });

  it('includes a stage that has a command but produced no output yet', () => {
    const [log] = buildLogs([logStage({ logSnippet: null, status: 'RUNNING', finishedAt: null })]);

    expect(log.lines).toEqual([]);
  });

  it('includes a stage that produced output but has no recorded command', () => {
    const [log] = buildLogs([logStage({ command: null })]);

    expect(log.command).toBe('');
  });

  it('drops blank lines so the gutter numbering stays contiguous', () => {
    const [log] = buildLogs([logStage({ logSnippet: 'one\n\n\ntwo\n' })]);

    expect(log.lines.map(l => l.content)).toEqual(['one', 'two']);
    expect(log.lines.map(l => l.lineNumber)).toEqual([1, 2]);
  });

  // The schema stores logSnippet as one blob with no per-line timestamps.
  it('leaves every timestamp blank', () => {
    const [log] = buildLogs([logStage({ logSnippet: 'a\nb\nc' })]);

    expect(log.lines.every(l => l.timestamp === '')).toBe(true);
  });

  it('renders an em dash when the stage never started', () => {
    const [log] = buildLogs([logStage({ startedAt: null })]);

    expect(log.duration).toBe('—');
  });

  it('measures a still-running stage against now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:02:00Z'));

    const [log] = buildLogs([logStage({ status: 'RUNNING', finishedAt: null })]);
    expect(log.duration).toBe('2m');

    jest.useRealTimers();
  });

  it('preserves stage order', () => {
    const logs = buildLogs([
      logStage({ stageName: 'test' }),
      logStage({ stageName: 'build' }),
    ]);

    expect(logs.map(l => l.jobName)).toEqual(['test', 'build']);
  });

  it('returns nothing for no stages', () => {
    expect(buildLogs([])).toEqual([]);
  });
});

describe('addNodeDetails', () => {
  /*
   * addNodeDetails folds the per-attempt StageResult rows onto their graph
   * nodes so the Run Detail graph and its stage panel can read one object.
   * Callers pass rows already ordered [stageId asc, attempt asc] — that
   * ordering is what makes the highest attempt win, so the tests below feed
   * them in that order deliberately.
   */
  const row = (over: Partial<StageResult> = {}): StageResult => ({
    id: 'sr1',
    runId: 'run1',
    stageId: 'a',
    stageName: 'build',
    stageType: 'CUSTOM',
    status: 'SUCCEEDED',
    exitCode: 0,
    logSnippet: null,
    command: 'npm run build',
    attempt: 1,
    maxRetries: 0,
    approvedById: null,
    approvedAt: null,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    finishedAt: new Date('2026-01-01T00:00:30Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  });

  const secretNode = (secrets: Record<string, string[]>): CustomNode => ({
    id: 'a', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'build', secrets },
  });

  describe('status and duration', () => {
    it('maps the stage status onto the node', () => {
      const [n] = addNodeDetails([node('a')], [row({ status: 'RUNNING', finishedAt: null })], new Map(), null);

      expect(n.data.status).toBe('running');
    });

    it('measures the duration between the row start and finish', () => {
      const [n] = addNodeDetails([node('a')], [row()], new Map(), null);

      expect(n.data.duration).toBe('30s');
    });

    it('measures a still-running stage against now', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:02:00Z'));

      const [n] = addNodeDetails([node('a')], [row({ status: 'RUNNING', finishedAt: null })], new Map(), null);
      expect(n.data.duration).toBe('2m');

      jest.useRealTimers();
    });

    // A queued run has graph nodes but no rows yet.
    it('reports a node with no stage row as pending with no duration', () => {
      const [n] = addNodeDetails([node('a')], [], new Map(), null);

      expect(n.data.status).toBe('pending');
      expect(n.data.duration).toBe('—');
    });

    it('preserves the definition data already on the node', () => {
      const configured: CustomNode = {
        id: 'a', position: { x: 0, y: 0 },
        data: { type: 'deploy', name: 'ship', command: 'npm run deploy', timeout: 900 },
      };

      const [n] = addNodeDetails([configured], [], new Map(), null);

      expect(n.data).toMatchObject({ type: 'deploy', name: 'ship', command: 'npm run deploy', timeout: 900 });
    });

    it('ignores a stage row with no matching node', () => {
      const nodes = addNodeDetails([node('a')], [row({ stageId: 'ghost', status: 'FAILED' })], new Map(), null);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].data.status).toBe('pending');
    });
  });

  describe('attempts', () => {
    // A retry is a new row, not a re-run, so a retried stage has several rows
    // for one stageId. The last one in ascending-attempt order is the truth.
    it('reports the highest attempt and that row status', () => {
      const [n] = addNodeDetails(
        [node('a')],
        [row({ attempt: 1, status: 'FAILED' }), row({ attempt: 2, status: 'RUNNING', finishedAt: null })],
        new Map(), null,
      );

      expect(n.data.attempt).toBe(2);
      expect(n.data.status).toBe('running');
    });

    it('reports attempt 1 for a stage that has not started', () => {
      expect(addNodeDetails([node('a')], [], new Map(), null)[0].data.attempt).toBe(1);
    });

    // maxRetries counts retries *after* the first try, so maxRetries: 2 means
    // attempts 1–3.
    it('derives maxAttempts from the row maxRetries', () => {
      const [n] = addNodeDetails([node('a')], [row({ maxRetries: 2 })], new Map(), null);

      expect(n.data.maxAttempts).toBe(3);
    });

    // Nothing has denormalized maxRetries onto a row yet, so the definition is
    // the only source.
    it('falls back to the definition retries when there is no row', () => {
      const configured: CustomNode = {
        id: 'a', position: { x: 0, y: 0 }, data: { type: 'custom', retries: 1 },
      };

      const [n] = addNodeDetails([configured], [], new Map(), null);

      expect(n.data).toMatchObject({ attempt: 1, maxAttempts: 2 });
    });

    it('reports a single attempt when neither the row nor the definition sets retries', () => {
      expect(addNodeDetails([node('a')], [], new Map(), null)[0].data.maxAttempts).toBe(1);
    });

    // The row is what the runner actually budgeted; the definition may have
    // been edited into a later version since.
    it('prefers the row maxRetries over the definition retries', () => {
      const configured: CustomNode = {
        id: 'a', position: { x: 0, y: 0 }, data: { type: 'custom', retries: 5 },
      };

      const [n] = addNodeDetails([configured], [row({ maxRetries: 1 })], new Map(), null);

      expect(n.data.maxAttempts).toBe(2);
    });
  });

  describe('secret keys', () => {
    const keys = new Map([['s1', 'API_KEY'], ['s2', 'DATABASE_URL']]);

    it('resolves the selected secret ids to keys', () => {
      const [n] = addNodeDetails([secretNode({ env1: ['s1', 's2'] })], [], keys, 'env1');

      expect(n.data.secretKeys).toEqual(['API_KEY', 'DATABASE_URL']);
    });

    // The editor keeps entries for previously selected environments, so reading
    // the whole map would leak the wrong environment's secrets into the panel.
    it('reads only the run environment entry', () => {
      const [n] = addNodeDetails([secretNode({ env1: ['s1'], env2: ['s2'] })], [], keys, 'env1');

      expect(n.data.secretKeys).toEqual(['API_KEY']);
    });

    // A secret deleted after the run was triggered no longer resolves.
    it('drops an id with no matching secret', () => {
      const [n] = addNodeDetails([secretNode({ env1: ['s1', 'gone'] })], [], keys, 'env1');

      expect(n.data.secretKeys).toEqual(['API_KEY']);
    });

    it('resolves nothing for a run with no environment', () => {
      const [n] = addNodeDetails([secretNode({ env1: ['s1'] })], [], keys, null);

      expect(n.data.secretKeys).toEqual([]);
    });

    it('resolves nothing when the stage selected no secrets', () => {
      expect(addNodeDetails([node('a')], [], keys, 'env1')[0].data.secretKeys).toEqual([]);
    });

    it('resolves nothing when the run environment has no entry', () => {
      const [n] = addNodeDetails([secretNode({ env2: ['s2'] })], [], keys, 'env1');

      expect(n.data.secretKeys).toEqual([]);
    });
  });
});
