import { countJobs, buildLogFilters, buildLogs, formatLines, addNodeDetails, type StageLite } from '@/lib/data/run-detail';
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

/* buildLogs and addNodeDetails both take whole StageResult rows, so they share this. */
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
  /*
   * The dropdown lists the stages the log pane can actually show, so it applies
   * the same status filter buildLogs does: a node with no eligible row is left
   * out entirely rather than listed as pending. The two must agree, or the filter
   * offers a stage with no panel behind it.
   */
  it('emits one option per eligible node in pipeline order, not stage order', () => {
    const nodes = [node('n3', 'deploy'), node('n1', 'build'), node('n2', 'test')];
    const stages = [stage('n1', 'SUCCEEDED'), stage('n2', 'RUNNING'), stage('n3', 'FAILED')];

    expect(buildLogFilters(nodes, stages).map(f => f.value)).toEqual(['n3', 'n1', 'n2']);
  });

  /*
   * The status rides alongside the label rather than inside it: FilterListbox
   * renders it as a Pill, so a label that spelled the status out would print it
   * twice. Every JobStatus is also a PillVariant, which is what makes that work.
   */
  it('labels an option with the bare stage name and reports its job status beside it', () => {
    const filters = buildLogFilters([node('n1', 'build')], [stage('n1', 'SUCCEEDED')]);

    expect(filters[0]).toEqual({ value: 'n1', label: 'build', status: 'succeeded' });
  });

  it.each(['SUCCEEDED', 'FAILED', 'RUNNING'] as const)('lists a %s stage', (status) => {
    expect(buildLogFilters([node('n1', 'build')], [stage('n1', status)])).toHaveLength(1);
  });

  it.each(['PENDING', 'QUEUED', 'AWAITING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'CANCELLED'] as const)(
    'omits a %s stage, which has no log panel behind it', (status) => {
      expect(buildLogFilters([node('n1', 'build')], [stage('n1', status)])).toEqual([]);
    });

  // A queued run has graph nodes but no StageResult rows at all.
  it('omits a node with no stage row', () => {
    expect(buildLogFilters([node('n1', 'build')], [])).toEqual([]);
  });

  // fromDefinition omits `name` entirely when it was never set, so the ?? ''
  // fallback is reachable from a real definition.
  it('renders an empty name rather than "undefined"', () => {
    const unnamed = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom' as const } };

    expect(buildLogFilters([unnamed], [stage('n1', 'SUCCEEDED')])[0].label).toBe('');
  });

  it('returns no options for an empty graph', () => {
    expect(buildLogFilters([], [])).toEqual([]);
  });
});

describe('buildLogs', () => {
  const logged = (over: Partial<StageResult> = {}) => row({ logSnippet: 'line one\nline two', ...over });

  it('maps an eligible row onto a log panel', () => {
    const [log] = buildLogs([logged()]);

    expect(log).toEqual({
      stageId: 'a',
      jobName: 'build',
      command: 'npm run build',
      attempt: 1,
      status: 'succeeded',
      duration: '30s',
      lines: [
        { lineNumber: 1, content: 'line one' },
        { lineNumber: 2, content: 'line two' },
      ],
    });
  });

  it.each(['SUCCEEDED', 'FAILED'] as const)('includes a %s stage', (status) => {
    expect(buildLogs([logged({ status })])).toHaveLength(1);
  });

  it('includes a RUNNING stage', () => {
    expect(buildLogs([logged({ status: 'RUNNING', finishedAt: null })])).toHaveLength(1);
  });

  // An approval gate or a stage that never ran has no output to show.
  it.each(['PENDING', 'QUEUED', 'AWAITING_APPROVAL', 'APPROVED', 'UNAPPROVED', 'CANCELLED'] as const)(
    'excludes a %s stage', (status) => {
      expect(buildLogs([logged({ status })])).toEqual([]);
    });

  it('returns nothing for no stages', () => {
    expect(buildLogs([])).toEqual([]);
  });

  /*
   * A retry is a new row, not a re-run, so an eligible stage can arrive as several
   * rows. Callers pass them ordered [stageId asc, attempt asc] and the Map fold is
   * last-write-wins, which makes the highest attempt the one panel shown - the same
   * rule addNodeDetails applies to the graph node.
   */
  describe('the retry fold', () => {
    it('keeps both attempts when a stage has several rows', () => {
      const logs = buildLogs([
        logged({ attempt: 1, status: 'FAILED', logSnippet: 'first try' }),
        logged({ attempt: 2, status: 'SUCCEEDED', logSnippet: 'second try' }),
      ]);

      expect(logs).toHaveLength(2);
      expect(logs[0].status).toBe('failed');
      expect(logs[0].lines).toEqual([{ lineNumber: 1, content: 'first try' }]);
      expect(logs[1].status).toBe('succeeded');
      expect(logs[1].lines).toEqual([{ lineNumber: 1, content: 'second try' }]);
    });

    it('keeps all panels per stage id', () => {
      const logs = buildLogs([
        logged({ stageId: 'a', stageName: 'build', attempt: 1 }),
        logged({ stageId: 'a', stageName: 'build', attempt: 2 }),
        logged({ stageId: 'b', stageName: 'test', attempt: 1 }),
      ]);

      expect(logs.map(l => l.jobName)).toEqual(['build', 'build', 'test']);
    });

    /*
     * openRetry writes attempt N+1 as PENDING *before* recording the failure on
     * attempt N, so during that window the only eligible row is the failed one.
     * The panel therefore still shows attempt N while addNodeDetails - which folds
     * every row, not just the eligible ones - already reads the stage as pending.
     */
    it('falls back to the last eligible attempt when the newest row is not eligible yet', () => {
      const logs = buildLogs([
        logged({ attempt: 1, status: 'FAILED', logSnippet: 'first try' }),
        logged({ attempt: 2, status: 'PENDING', logSnippet: null }),
      ]);

      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('failed');
    });
  });

  describe('duration', () => {
    it('measures a finished stage between its start and finish', () => {
      expect(buildLogs([logged()])[0].duration).toBe('30s');
    });

    it('measures a still-running stage against now', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:02:00Z'));

      expect(buildLogs([logged({ status: 'RUNNING', finishedAt: null })])[0].duration).toBe('2m');

      jest.useRealTimers();
    });

    it('renders an em dash when the stage never started', () => {
      expect(buildLogs([logged({ startedAt: null, finishedAt: null })])[0].duration).toBe('—');
    });
  });

  describe('missing fields', () => {
    it('renders a row with no recorded command as an empty command', () => {
      expect(buildLogs([logged({ command: null })])[0].command).toBe('');
    });

    it('renders a stage that has a command but no output yet as an empty body', () => {
      expect(buildLogs([logged({ logSnippet: null, status: 'RUNNING', finishedAt: null })])[0].lines).toEqual([]);
    });

    it('still emits a panel for a row with neither a command nor a snippet', () => {
      expect(buildLogs([logged({ command: null, logSnippet: null })])).toEqual([
        { stageId: 'a', attempt: 1, jobName: 'build', command: '', status: 'succeeded', duration: '30s', lines: [] },
      ]);
    });
  });

  it('emits panels in row order rather than graph order', () => {
    const logs = buildLogs([
      logged({ stageId: 'a-test', stageName: 'test' }),
      logged({ stageId: 'b-build', stageName: 'build' }),
    ]);

    expect(logs.map(l => l.jobName)).toEqual(['test', 'build']);
  });
});

describe('formatLines', () => {
  const contents = (snippet: string | null) => formatLines(snippet).map(l => l.content);

  it('splits a snippet on newlines', () => {
    expect(contents('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
  });

  it('numbers the lines from one, contiguously', () => {
    expect(formatLines('one\ntwo\nthree').map(l => l.lineNumber)).toEqual([1, 2, 3]);
  });

  it('keeps a snippet with no newline as a single line', () => {
    expect(formatLines('just the one')).toEqual([{ lineNumber: 1, content: 'just the one' }]);
  });

  it('returns nothing for a null snippet', () => {
    expect(formatLines(null)).toEqual([]);
  });

  it('returns nothing for an empty snippet', () => {
    expect(formatLines('')).toEqual([]);
  });

  // A command's output almost always ends in a newline; that terminator closes the
  // last line rather than opening an empty one.
  it('does not add an empty line for a trailing newline', () => {
    expect(contents('one\ntwo\n')).toEqual(['one', 'two']);
  });

  /*
   * Blank lines survive, and the gutter still counts contiguously. This reverses
   * the previous implementation, which dropped them - a log's blank lines are its
   * own output, and dropping them silently misreports what the command printed.
   */
  it('preserves blank lines between content', () => {
    expect(contents('one\n\n\ntwo\n')).toEqual(['one', '', '', 'two']);
    expect(formatLines('one\n\n\ntwo\n').map(l => l.lineNumber)).toEqual([1, 2, 3, 4]);
  });

  it('reads a lone newline as a single empty line', () => {
    expect(contents('\n')).toEqual(['']);
  });

  it('keeps leading and trailing whitespace on a line', () => {
    expect(contents('  indented  \nplain')).toEqual(['  indented  ', 'plain']);
  });

  /*
   * TODO(bug): only '\n' terminates a line, so CRLF output leaves a '\r' on the end
   * of every line's content. The runner spawns with `shell: true` and the dev box is
   * Windows, so this is reachable - and it silently breaks LogLine's `$` prompt,
   * which LogViewer decides with `line.content === command`: 'npm run build\r' never
   * equals 'npm run build'. Asserted as-is so the suite goes red when it is fixed.
   */
  it('leaves the carriage return on each line of CRLF output', () => {
    expect(contents('one\r\ntwo\r\n')).toEqual(['one\r', 'two\r']);
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
