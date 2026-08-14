import { spawn, type ChildProcess } from 'node:child_process';

/** Matches the "last ~50 lines" the StageResult.logSnippet column documents. */
export const LOG_SNIPPET_LINES = 50;

/** How long a command gets to clean up after SIGTERM before SIGKILL. POSIX only — see killTree. */
const KILL_GRACE_MS = 5_000;

/*
 * A single line is truncated past this. maxLines alone bounds the line *count* and not the
 * memory: one command emitting a minified bundle or a base64 artifact with no newline in it
 * grows the pending line without limit and takes the runner down — along with every other
 * stage running concurrently.
 */
const MAX_LINE_CHARS = 2_000;

/*
 * Every child currently running, so shutdown can take them down with it.
 *
 * `detached: true` puts a POSIX child in its own session, which means it does not receive
 * the terminal's Ctrl-C and does not die when this process exits. Without this registry a
 * shutdown that hits its deadline leaves the command running inside the run's workspace,
 * where the next boot's reaper will fail the row and a re-triggered run can spawn a second
 * process into the same directory alongside it.
 */
const running = new Set<ChildProcess>();

/** Terminates every in-flight command. Called by the entrypoint on the way out. */
export function killAllChildren(): void {
  for (const child of running) killTree(child, true);
}

export interface ExecuteOptions {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxLines?: number;
}

export interface ExecuteResult {
  exitCode: number | null;
  /** Set when the child was terminated by a signal instead of exiting on its own. */
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  logSnippet: string;
}

/*
==============================================================================================
 * Runs one shell command to completion and reports what happened.
 *
 * Resolves for any outcome the command itself produced, including a non-zero exit and a
 * timeout — those are results the processor records, not errors. It rejects only when the
 * child could not be started at all, which is the one case with nothing to report.
 *
==============================================================================================
*/
export function execute(
  { command, cwd, env, timeoutMs, maxLines = LOG_SNIPPET_LINES }: ExecuteOptions,
): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const log = createLineBuffer(maxLines);
    let timedOut = false;
    let settled = false;

    const child = spawn(command, {
      shell: true,
      cwd,
      env,
      // Makes the child a process-group leader so killTree can signal the group. Windows
      // has no process groups in this sense, and `detached` there pops a console window,
      // so it stays off — taskkill /T walks the tree instead.
      detached: process.platform !== 'win32',
      windowsHide: true,
    });

    running.add(child);

    let graceTimer: NodeJS.Timeout | undefined;

    const deadline = setTimeout(() => {
      // Set from whether a signal was actually delivered, not unconditionally: the deadline
      // can fire in the gap between the command exiting and 'close' arriving, and reporting
      // a clean run as timed out would append a note contradicting its own exit code.
      timedOut = killTree(child, false);
      if (!timedOut) return;

      graceTimer = setTimeout(() => killTree(child, true), KILL_GRACE_MS);

      graceTimer.unref(); // prevents timer from being reason runner refuses to exit at shutdown
    }, timeoutMs);

    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      running.delete(child);
      clearTimeout(deadline);
      clearTimeout(graceTimer);
      settle();
    };

    
    child.stdout.on('data', chunk => {
      const text = String(chunk);
      log.write(text);
      console.log(`[${command}] ${text}`);
    });

    child.stderr.on('data', chunk => {
      const text = String(chunk);
      log.write(text);
      console.error(`[${command}] ${text}`);
    });

    child.stdout.on('error', () => { });
    child.stderr.on('error', () => { });

    child.on('error', error => finish(() => reject(error)));

    
    child.on('close', (exitCode, signal) => finish(() => resolve({
      exitCode,
      signal,
      timedOut,
      logSnippet: log.flush(),
    })));
  });
}

/*
==============================================================================================
 * Terminates the command and everything it started.
 *
 * `shell: true` means the direct child is the *shell* — the command anyone cares about is
 * its child, and often has children of its own. Signalling the shell alone orphans that
 * whole tree: it keeps running, keeps holding the run's workspace directory, and keeps the
 * stdout pipe open so 'close' never fires.
 *
 * The two platforms need different mechanisms, so both exist. On POSIX the negative pid
 * signals the process group, which `detached: true` above created. On Windows taskkill /T
 * walks the tree by pid; there is no meaningful graceful stage there, so `force` is
 * ignored and the second call simply finds nothing left to kill.
 *
 * Returns whether a signal was actually delivered, so a caller can tell "killed it" from
 * "it had already gone".
==============================================================================================
*/
function killTree(child: ChildProcess, force: boolean): boolean {
  // guard that if true, means the process was already deleted/ended
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return false;

  try {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        // unref() releases the process handle but not the three stdio handles, and nothing
        // reads taskkill's output.
        stdio: 'ignore',
      });
      // taskkill exits non-zero when the tree is already gone; that is not worth reporting,
      // and an unhandled 'error' here would take the runner down.
      killer.on('error', () => { });
      killer.unref();
    } else {
      process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
    }

    return true;
  } catch {
    // ESRCH: the tree exited between the guard above and the signal. Nothing to do.
    return false;
  }
}



function createLineBuffer(maxLines: number) {
  const lines: string[] = [];
  let partial = '';

  const push = (line: string) => {
    lines.push(line);
    if (lines.length > maxLines) lines.shift();
  };

  return {
    write(chunk: string) {
      const parts = (partial + chunk).split('\n');
      // The trailing piece has no newline yet, so it is not a complete line — hold it
      // until the next chunk arrives or the stream closes.
      partial = parts.pop() ?? '';
      for (const line of parts) push(truncate(line.replace(/\r$/, ''))); // regex strips hidden Windows-style line at end of text (\r)

      // A command can emit megabytes without ever writing a newline, and the held piece
      // would grow with all of it. Once it is past what would be kept anyway, bank it.
      if (partial.length > MAX_LINE_CHARS) {
        push(truncate(partial));
        partial = '';
      }
    },

    flush(): string {
      if (partial) {
        push(truncate(partial));
        partial = '';
      }
      return lines.join('\n');
    },
  };
}

const truncate = (line: string) =>
  line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line;
