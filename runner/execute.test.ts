/**
 * @jest-environment node
 *
 * The one file in the unit tier that overrides jest.config.mjs's global jsdom. Everything
 * else in lib/ and runner/ is environment-neutral; execute.ts is not, and jsdom's timer
 * shim returns a plain number with no unref(), so the timeout cases would fail against a
 * detail of the test environment rather than of the code.
 */
import { execute, killAllChildren } from './execute';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/*
 * The only runner test that spawns for real, because the things worth asserting here —
 * that a kill reaches the whole process tree, that the tail survives the exit — are
 * exactly the things a mocked child_process would let through.
 *
 * Every command is `process.execPath -e "<script>"`. Never `sleep`, `echo` or `&&`:
 * this suite runs on Windows locally and ubuntu-latest in CI, and those differ. The
 * quoting below is the one form both shells agree on — outer double quotes around
 * both the path and the script, inner single quotes for any JS string. Avoid `%` (cmd
 * expands it) and prefer `<` only inside the quotes (cmd would read a bare one as a
 * redirect).
 */
const node = (script: string) => `"${process.execPath}" -e "${script}"`;

const run = (command: string, over: Partial<Parameters<typeof execute>[0]> = {}) =>
  execute({ command, cwd: process.cwd(), env: process.env, timeoutMs: 10_000, maxLines: 50, ...over });

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => { });
  jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => { jest.restoreAllMocks(); });

describe('exit status', () => {
  it('reports a clean exit', async () => {
    expect(await run(node('process.exit(0)'))).toEqual(
      expect.objectContaining({ exitCode: 0, timedOut: false }),
    );
  });

  // A non-zero exit is a recorded outcome, not a thrown error. The processor decides
  // what it means; execute only reports it. Rejecting here instead would turn every
  // failing build into an infrastructure error and skip the bookkeeping.
  it('resolves rather than rejects on a non-zero exit', async () => {
    expect(await run(node('process.exit(3)'))).toEqual(
      expect.objectContaining({ exitCode: 3, timedOut: false }),
    );
  });

  // Bad cwd is the one spawn failure reachable under shell: true — an unknown command
  // is the *shell's* problem and comes back as an ordinary non-zero exit instead.
  it('rejects when the child cannot be spawned at all', async () => {
    await expect(run(node('process.exit(0)'), { cwd: 'no-such-directory-anywhere' }))
      .rejects.toThrow();
  });
});

describe('the log snippet', () => {
  it('captures stdout', async () => {
    const { logSnippet } = await run(node("process.stdout.write('from stdout')"));

    expect(logSnippet).toContain('from stdout');
  });

  // Both streams share one buffer so the snippet reads the way the terminal would.
  // A stage that fails usually says why on stderr, so dropping it would leave the
  // Run Detail page showing an empty snippet for exactly the runs someone opens it for.
  it('captures stderr', async () => {
    const { logSnippet } = await run(node("process.stderr.write('from stderr')"));

    expect(logSnippet).toContain('from stderr');
  });

  it('keeps the last maxLines, not the first', async () => {
    const { logSnippet } = await run(
      node("for(let i=1;i<=60;i++)console.log('line'+i)"),
      { maxLines: 50 },
    );
    const lines = logSnippet.split('\n');

    expect(lines).toHaveLength(50);
    expect(lines[0]).toBe('line11');
    expect(lines.at(-1)).toBe('line60');
  });

  // Chunks arrive on pipe boundaries, not line boundaries, so the last write of a
  // command that does not end in a newline sits in the partial-line remainder. Without
  // an explicit flush it is dropped — and that is usually the error message.
  it('keeps a final line that has no trailing newline', async () => {
    const { logSnippet } = await run(node("process.stdout.write('no newline here')"));

    expect(logSnippet).toBe('no newline here');
  });

  // Waiting on 'close' rather than 'exit' is what makes this pass: 'exit' fires when the
  // process ends, which can be before the last stdout chunk has been read.
  it('does not lose output written immediately before exiting', async () => {
    const { logSnippet } = await run(node("process.stdout.write('last gasp');process.exit(7)"));

    expect(logSnippet).toContain('last gasp');
  });

  it('returns an empty snippet for a silent command', async () => {
    expect((await run(node('process.exit(0)'))).logSnippet).toBe('');
  });
});

describe('timeouts', () => {
  /*
   * Nothing is asserted about exitCode or signal: POSIX reports null plus SIGKILL, Windows
   * reports taskkill's own status. Only `timedOut` is portable.
   */
  it('kills a command that outlives its timeout', async () => {
    const { timedOut } = await run(node('setTimeout(()=>{},30000)'), { timeoutMs: 250 });

    expect(timedOut).toBe(true);
  }, 20_000);

  /*
   * On POSIX the deadline sends SIGTERM and only escalates to SIGKILL after the grace
   * window, so a command that installs a SIGTERM handler and ignores it is the only thing
   * that proves the escalation happens at all — without it this case hangs until Jest gives
   * up. On Windows taskkill /F is unconditional and this passes on the first attempt, which
   * is why the assertion stays limited to `timedOut`.
   */
  it('escalates to a hard kill when the command ignores the first signal', async () => {
    const { timedOut } = await run(
      node('process.on(\'SIGTERM\',()=>{});setInterval(()=>{},1000)'),
      { timeoutMs: 250 },
    );

    expect(timedOut).toBe(true);
  }, 20_000);

  it('still returns whatever the command printed before it was killed', async () => {
    const { logSnippet } = await run(
      node("console.log('printed before the kill');setTimeout(()=>{},30000)"),
      { timeoutMs: 500 },
    );

    expect(logSnippet).toContain('printed before the kill');
  }, 20_000);

  it('leaves timedOut false when the command finishes in time', async () => {
    expect((await run(node('process.exit(1)'), { timeoutMs: 10_000 })).timedOut).toBe(false);
  });
});

/*
 * `shell: true` makes the shell the direct child, and the command anyone cares about its
 * descendant. Signalling the shell alone orphans that whole subtree: it keeps running, keeps
 * holding the run's workspace, and keeps the stdout pipe open.
 *
 * A naive version of this test — `node -e "…"` and assert it resolves — proves nothing on
 * Linux, which is the only place the suite runs unattended. `sh -c 'node -e …'` is a single
 * simple command, so dash and bash *exec* it without forking: node becomes the direct child
 * and a plain child.kill() would pass. Only a real grandchild distinguishes the two, so the
 * command below is a script that spawns one, and the assertion is that the grandchild stops
 * writing to disk once execute has returned.
 */
describe('killing the process tree', () => {
  // Written to a file rather than passed with -e: this needs to spawn a grandchild, and
  // nesting that inside a shell-quoted -e argument portably is not worth the trouble.
  const PARENT_SCRIPT = `
    const { spawn } = require('node:child_process');
    const keepWriting = "setInterval(function(){ require('node:fs').appendFileSync(process.argv[1], 'x'); }, 50)";
    // stdio: 'inherit' hands the grandchild the same stdout pipe, which is what makes a
    // shell-only kill hang instead of merely leaking.
    spawn(process.execPath, ['-e', keepWriting, process.argv[2]], { stdio: 'inherit' });
    setTimeout(function () { }, 60000);
  `;

  const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  let workspace: string;

  beforeEach(async () => { workspace = await mkdtemp(path.join(tmpdir(), 'deplo-tree-')); });
  afterEach(async () => { await rm(workspace, { recursive: true, force: true }); });

  it('stops a grandchild the command spawned, not only the shell', async () => {
    const script = path.join(workspace, 'parent.cjs');
    const marker = path.join(workspace, 'alive.txt');
    await writeFile(script, PARENT_SCRIPT);

    const { timedOut } = await run(`"${process.execPath}" "${script}" "${marker}"`, { timeoutMs: 1_000 });
    expect(timedOut).toBe(true);

    // Proves the grandchild existed at all — without this the case would pass trivially if
    // the script never managed to spawn one.
    const afterKill = (await stat(marker)).size;
    expect(afterKill).toBeGreaterThan(0);

    // It was appending every 50ms, so anything still alive grows this by ~14 writes.
    await settle(700);
    expect((await stat(marker)).size).toBe(afterKill);
  }, 30_000);
});

/*
 * Commands are spawned `detached` on POSIX so the process group can be signalled, which also
 * means they do not receive the terminal's Ctrl-C and do not die with this process. Shutdown
 * therefore has to kill them explicitly, or a runner stopped mid-stage leaves the command
 * running in a workspace the next boot knows nothing about.
 */
describe('killAllChildren', () => {
  it('terminates a command that is still in flight', async () => {
    const pending = run(node('setTimeout(()=>{},30000)'), { timeoutMs: 60_000 });
    await new Promise(resolve => setTimeout(resolve, 400));

    killAllChildren();

    // timedOut stays false: this was shutdown, not the stage's own deadline. That the
    // promise settles at all is the property under test.
    expect((await pending).timedOut).toBe(false);
  }, 20_000);

  it('is a no-op when nothing is running', () => {
    expect(() => killAllChildren()).not.toThrow();
  });
});
