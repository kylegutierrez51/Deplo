import { countJobs, buildLogFilters, buildLogs, type StageLite } from '@/lib/data/run-detail';
import type { CustomNode } from '@/lib/types';
import type { StageStatus as PrismaStageStatus } from '@/generated/prisma';

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
