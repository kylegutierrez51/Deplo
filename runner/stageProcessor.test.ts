import { processStage } from './stageProcessor';
import { loadRunContext, markStageRunning, finishStage, openRetry } from './db';
import { execute } from './execute';
import { resolveSecrets } from './secrets';
import { advanceRun } from './runProcessor';
import type { CustomNode } from '@/lib/types';

/*
 * Explicit factories throughout, never a bare jest.mock: an automock loads the real module
 * to introspect its shape, which is exactly what has to be avoided here. runProcessor pulls
 * in stageQueue, which constructs a BullMQ Queue at module scope — untransformed ESM from
 * msgpackr, plus a live ioredis socket. db and secrets open a pg connection through
 * lib/prisma the same way. Same reasoning as the next/cache note in CLAUDE.md.
 */
jest.mock('./db', () => ({
  loadRunContext: jest.fn(),
  markStageRunning: jest.fn(),
  finishStage: jest.fn(),
  openRetry: jest.fn(),
}));
jest.mock('./execute', () => ({ execute: jest.fn() }));
jest.mock('./secrets', () => ({ resolveSecrets: jest.fn() }));
jest.mock('./runProcessor', () => ({ advanceRun: jest.fn() }));

/*
 * processStage owns a RUNNING row from the moment markStageRunning wins, so the property
 * worth defending is that every path out of it writes a terminal status. A path that
 * returns early — an unresolvable secret, a command that will not spawn — leaves the stage
 * RUNNING forever and deadlocks everything downstream, with nothing in the UI to say why.
 *
 * The other half is the retry decision, and specifically its ordering: the failed row must
 * be FAILED before the next attempt is opened, and the next attempt must exist before
 * advanceRun recomputes. Get that wrong and the run finalizes as FAILED with a retry row
 * sitting behind it that nothing will ever enqueue.
 */

const loadContext = loadRunContext as jest.MockedFunction<typeof loadRunContext>;
const claim = markStageRunning as jest.MockedFunction<typeof markStageRunning>;
const finish = finishStage as jest.MockedFunction<typeof finishStage>;
const retry = openRetry as jest.MockedFunction<typeof openRetry>;
const run = execute as jest.MockedFunction<typeof execute>;
const secrets = resolveSecrets as jest.MockedFunction<typeof resolveSecrets>;
const advance = advanceRun as jest.MockedFunction<typeof advanceRun>;

const job = { runId: 'run-1', stageId: 'build', attempt: 1 };

const stageNode = (data: Record<string, unknown> = {}) => ({
  id: 'build',
  position: { x: 0, y: 0 },
  data: { type: 'custom', name: 'build', command: 'npm ci', ...data },
}) as CustomNode;

const context = (node = stageNode(), environmentId: string | null = 'env-1') =>
  loadContext.mockResolvedValue({
    runId: 'run-1',
    runStatus: 'RUNNING',
    definitionId: 'def-1',
    environmentId,
    graph: { nodes: [node], edges: [] },
    outcomes: new Map(),
    attempts: new Map([['build', 1]]),
  } as never);

const exited = (exitCode: number | null, over: Record<string, unknown> = {}) =>
  run.mockResolvedValue({ exitCode, signal: null, timedOut: false, logSnippet: '', ...over } as never);

/** What was written as this attempt's terminal state. */
const recorded = () => finish.mock.calls[0][3];
/** The options execute() was called with. */
const spawned = () => run.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  claim.mockResolvedValue(true);
  finish.mockResolvedValue(true);
  retry.mockResolvedValue(true);
  secrets.mockResolvedValue({});
  context();
  exited(0);
  jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('taking ownership', () => {
  // A redelivered job, or another worker already holding the row. Doing anything past
  // this point would run the command a second time.
  it('runs nothing when the claim is lost', async () => {
    claim.mockResolvedValue(false);

    await processStage(job);

    expect(run).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  // The one safe early return: the run was deleted and took the row with it by cascade,
  // so there is no longer anything to write a terminal status to.
  it('stops when the run has gone', async () => {
    loadContext.mockResolvedValue(null);

    await processStage(job);

    expect(run).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });
});

describe('recording the result', () => {
  it('writes SUCCEEDED for a clean exit', async () => {
    await processStage(job);

    expect(recorded()).toEqual(expect.objectContaining({ status: 'SUCCEEDED', exitCode: 0 }));
  });

  it('writes FAILED for a non-zero exit, keeping the code and the tail', async () => {
    exited(2, { logSnippet: 'npm ERR! missing script' });

    await processStage(job);

    expect(recorded()).toEqual({
      status: 'FAILED', exitCode: 2, logSnippet: 'npm ERR! missing script',
    });
  });

  it('addresses the attempt the job named', async () => {
    await processStage({ ...job, attempt: 3 });

    expect(finish).toHaveBeenCalledWith('run-1', 'build', 3, expect.anything());
  });

  // Whatever happened, the scheduler has to be told to look again — this is the only
  // thing that moves the run forward.
  it.each([
    ['a success', 0],
    ['a failure', 1],
  ])('advances the run after %s', async (_label, exitCode) => {
    exited(exitCode);

    await processStage(job);

    expect(advance).toHaveBeenCalledWith('run-1');
  });
});

describe('the command environment', () => {
  it('runs in the workspace directory for this run', async () => {
    await processStage(job);

    expect(spawned().cwd).toContain('run-1');
  });

  it('passes the stage env vars through', async () => {
    context(stageNode({ env_vars: [{ key: 'NODE_ENV', value: 'test' }] }));

    await processStage(job);

    expect(spawned().env).toEqual(expect.objectContaining({ NODE_ENV: 'test' }));
  });

  it('resolves secrets against the run environment, not the node', async () => {
    context(stageNode({ secrets: { 'env-1': ['s1'] } }), 'env-1');

    await processStage(job);

    expect(secrets).toHaveBeenCalledWith({ 'env-1': ['s1'] }, 'env-1');
  });

  it('adds the decrypted secrets to the environment', async () => {
    secrets.mockResolvedValue({ API_KEY: 'sk-live-123' });

    await processStage(job);

    expect(spawned().env).toEqual(expect.objectContaining({ API_KEY: 'sk-live-123' }));
  });

  /*
   * A pipeline command is arbitrary user-authored shell running with the runner's own
   * environment. ENCRYPTION_KEY is the AES-256-GCM key for every secret in every
   * environment, so `echo $ENCRYPTION_KEY` in any stage would hand back the means to
   * decrypt all of them — and make the per-environment scoping in secrets.ts pointless.
   * DATABASE_URL is the same story one step removed.
   *
   * The names are spelled out here rather than imported from WITHHELD_FROM_COMMANDS on
   * purpose. Iterating the list under test would only prove the runner strips whatever the
   * list happens to say, so deleting an entry would delete its own coverage and stay green.
   * Written out, this is a second copy that has to be edited deliberately.
   */
  it.each([
    'ENCRYPTION_KEY', 'DATABASE_URL', 'AUTH_SECRET',
    'NEXTAUTH_SECRET', 'NEXTAUTH_URL',
    'REDIS_HOST', 'REDIS_PORT',
  ])(
    'withholds %s from the command', async (variable) => {
      process.env[variable] = 'should-not-reach-the-child';

      await processStage(job);

      expect(spawned().env).not.toHaveProperty(variable);
    });

  /*
   * On the same list for a different reason, so it is pinned separately: NODE_ENV is not a
   * secret and the case above would misfile it.
   *
   * Node tooling sets NODE_ENV only when nothing already has, which makes an inherited value
   * an override that wins rather than a default a command falls back to. runner/env.ts
   * dotenv-loads .env, so the runner has one to pass on, and passing it on made `next build`
   * in a stage bundle React's development build and fail prerendering /_global-error, and
   * made `jest` skip .env.test and point the integration tier at the development database.
   * Neither reported the real cause.
   *
   * Note that nothing is written to process.env here: jest.config.mjs pins NODE_ENV at
   * module scope, so the leak this guards against is already set up by the time this runs.
   */
  it('withholds NODE_ENV so a command chooses its own mode', async () => {
    // The premise — without a value on the runner there would be nothing to leak.
    expect(process.env.NODE_ENV).toBeDefined();

    await processStage(job);

    expect(spawned().env).not.toHaveProperty('NODE_ENV');
  });

  it('still passes the ambient environment a command actually needs', async () => {
    await processStage(job);

    // PATH under whichever casing the platform uses — Windows normalizes to Path.
    expect(spawned().env.PATH ?? spawned().env.Path).toBeDefined();
  });

  // A stage that lists both usually has a placeholder in the visible half, so the
  // encrypted value is the one that should reach the command.
  it('lets a secret win a name collision with a plain env var', async () => {
    context(stageNode({ env_vars: [{ key: 'API_KEY', value: 'placeholder' }] }));
    secrets.mockResolvedValue({ API_KEY: 'sk-live-123' });

    await processStage(job);

    expect(spawned().env.API_KEY).toBe('sk-live-123');
  });
});

describe('timeouts', () => {
  it('converts the configured seconds into milliseconds', async () => {
    context(stageNode({ timeout: 90 }));

    await processStage(job);

    expect(spawned().timeoutMs).toBe(90_000);
  });

  // The editor leaves the field blank by default. Unbounded would mean one hung command
  // holding a worker slot for good and blocking graceful shutdown forever.
  it.each([
    ['no timeout is configured', {}],
    ['the timeout is zero', { timeout: 0 }],
  ])('falls back to the default ceiling when %s', async (_label, data) => {
    context(stageNode(data));

    await processStage(job);

    expect(spawned().timeoutMs).toBeGreaterThan(0);
    expect(spawned().timeoutMs).toBe(30 * 60 * 1000);
  });

  /*
   * A killed command rarely explains itself, and on POSIX the exit code comes back null,
   * so without this line the Run Detail page shows a stage that failed for no visible
   * reason. The note goes after the captured output, where the eye lands last.
   */
  it('says so in the snippet when the stage was killed at its timeout', async () => {
    context(stageNode({ timeout: 30 }));
    exited(null, { timedOut: true, logSnippet: 'still working...' });

    await processStage(job);

    expect(recorded().logSnippet).toBe('still working...\n[stage exceeded its 30s timeout and was terminated]');
  });
});

describe('opening a retry', () => {
  it('opens one after a command that ran and failed', async () => {
    exited(1);

    await processStage(job);

    expect(retry).toHaveBeenCalledWith('run-1', 'build', 1);
  });

  it('does not open one after a success', async () => {
    await processStage(job);

    expect(retry).not.toHaveBeenCalled();
  });

  // The user's call: a hang is often transient, and retries: 0 already expresses
  // "do not try again" for anyone who disagrees.
  it('treats a timeout as retryable like any other failure', async () => {
    exited(null, { timedOut: true });

    await processStage(job);

    expect(retry).toHaveBeenCalled();
  });

  /*
   * The ordering is the whole defence, and it is defending against another worker rather
   * than against anything in this function.
   *
   * loadRunContext folds rows last-write-wins over ascending attempt, so whatever the
   * highest attempt says IS the stage's status. Recording FAILED before the retry row
   * exists opens a window where that is the latest word — and with concurrency 5 the other
   * slots are live. A sibling finishing inside it calls advanceRun, runOutcome sees a
   * failure-terminal stage, finalizeRun wins, cancelPendingStages sweeps, and the retry
   * lands as an orphan row in a run nothing will advance again. The retry silently never
   * happens and the run reports FAILED on a failure that was configured to be retried.
   *
   * Opening attempt N+1 first means the stage goes RUNNING → PENDING as far as any reader
   * is concerned, and runOutcome never sees the failure at all.
   */
  it('opens the retry before recording the failure, leaving no window to observe', async () => {
    exited(1);

    await processStage(job);

    expect(retry.mock.invocationCallOrder[0]).toBeLessThan(finish.mock.invocationCallOrder[0]);
  });

  it('records the failure before advancing the run', async () => {
    exited(1);

    await processStage(job);

    expect(finish.mock.invocationCallOrder[0]).toBeLessThan(advance.mock.invocationCallOrder[0]);
  });

  // The stage is still RUNNING when the retry is opened, so openRetry's own guard is what
  // establishes ownership. Passing the failed attempt is what makes it address the right row.
  it('names the attempt that just failed, not the one it is opening', async () => {
    exited(1);

    await processStage({ ...job, attempt: 2 });

    expect(retry).toHaveBeenCalledWith('run-1', 'build', 2);
  });
});

describe('failures that never reached the command', () => {
  const unresolvable = () => secrets.mockRejectedValue(new Error('secrets not found in environment env-1: s2'));

  it('records the stage as failed rather than leaving it RUNNING', async () => {
    unresolvable();

    await processStage(job);

    expect(recorded()).toEqual(expect.objectContaining({ status: 'FAILED', exitCode: null }));
  });

  // The message is the only thing the person looking at the failed stage will see, and it
  // names the id they need to go and look for.
  it('puts the reason in the log snippet', async () => {
    unresolvable();

    await processStage(job);

    expect(recorded().logSnippet).toContain('s2');
  });

  it('never spawns anything', async () => {
    unresolvable();

    await processStage(job);

    expect(run).not.toHaveBeenCalled();
  });

  /*
   * A missing secret will still be missing in five seconds, and a workspace that has
   * vanished will not reappear. Retrying these burns the whole budget to arrive at the
   * same failure, pushing the message that actually explains it further up the page.
   */
  it.each([
    ['a secret that no longer resolves', () => secrets.mockRejectedValue(new Error('gone'))],
    ['a child that could not be spawned', () => run.mockRejectedValue(new Error('ENOENT'))],
  ])('does not retry %s', async (_label, fail) => {
    fail();

    await processStage(job);

    expect(retry).not.toHaveBeenCalled();
  });

  it('still advances the run so it can finalize', async () => {
    unresolvable();

    await processStage(job);

    expect(advance).toHaveBeenCalledWith('run-1');
  });

  // Unreachable in practice — validatePipelineGraph rejects it and approval stages are
  // never enqueued — but leaving the row RUNNING would be the worst possible response.
  it('fails a stage whose node carries no command', async () => {
    context(stageNode({ command: undefined }));

    await processStage(job);

    expect(run).not.toHaveBeenCalled();
    expect(recorded()).toEqual(expect.objectContaining({ status: 'FAILED' }));
  });
});
