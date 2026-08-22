import { spawn, type ChildProcess } from 'node:child_process';

export const LOG_SNIPPET_LINES = 50;

const KILL_GRACE_MS = 5_000;
const MAX_LINE_CHARS = 2_000;
const SNAPSHOT_INTERVAL_MS = 2_000;

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

export function killAllChildren(): void {
  for (const child of running) killTree(child, true);
}

export interface ExecuteOptions {
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxLines?: number;
  onSnapshot?: (logSnippet: string) => void;
  snapshotMs?: number;
  signal?: AbortSignal;
}

export interface ExecuteResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  logSnippet: string;
}

/*
==============================================================================================
 * Runs one shell command to completion and reports what happened.
 *
 * Resolves for any outcome the command itself produced, including a non-zero exit and a
 * timeout — those are results the processor records, not errors. It rejects only when the
 * child could not be started at all, which is the one case with nothing to report.
==============================================================================================
*/
export function execute(
  {
    command, cwd, env, timeoutMs,
    maxLines = LOG_SNIPPET_LINES,
    onSnapshot,
    snapshotMs = SNAPSHOT_INTERVAL_MS,
    signal,
  }: ExecuteOptions,
): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const log = createLineBuffer(maxLines);
    let timedOut = false;
    let cancelled = false;
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

    // used by both 'deadline' and 'onAbort' for timeouts and cancels
    const terminate = (): boolean => {
      if (!killTree(child, false)) return false;

      graceTimer = setTimeout(() => killTree(child, true), KILL_GRACE_MS);
      graceTimer.unref(); // prevents timer from being reason runner refuses to exit at shutdown

      return true;
    };

    const deadline = setTimeout(() => { timedOut = terminate(); }, timeoutMs);

    const onAbort = () => { cancelled = terminate(); };

    // handle a signal already aborted before 'execute()' was called.
    if (signal?.aborted) cancelled = terminate();

    else signal?.addEventListener('abort', onAbort, { once: true });


    let lastSent = '';

    const snapshots = onSnapshot && setInterval(() => {
      const tail = log.peek();
      if (tail === lastSent) return;

      lastSent = tail;
      onSnapshot(tail);
    }, snapshotMs);

    snapshots?.unref(); // same reasoning as graceTimer above

    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      running.delete(child);
      clearTimeout(deadline);
      clearTimeout(graceTimer);
      clearInterval(snapshots);
      signal?.removeEventListener('abort', onAbort);
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

    child.on('close', (exitCode, signalCode) => finish(() => resolve({
      exitCode,
      signal: signalCode,
      timedOut,
      cancelled,
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
 * signals the process group, which `detached: true` above created. On Windows, taskkill /T
 * walks the tree by pid; there is no meaningful graceful stage there, so `force` is
 * ignored and the second call simply finds nothing left to kill.
 *
 * Returns whether a signal was actually delivered, so a caller can tell "killed it" from
 * "it had already gone".
==============================================================================================
*/
function killTree(child: ChildProcess, force: boolean): boolean {
  // The one state with nothing to signal either way: spawn never got far enough to
  // produce a pid, so there is no child and no group.
  if (child.pid === undefined) return false;

  try {
    if (process.platform === 'win32') {
      if (child.exitCode !== null || child.signalCode !== null) return false;

      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        // unref() releases the process handle but not the three stdio handles, and nothing
        // reads taskkill's output.
        stdio: 'ignore',
      });
      // taskkill exits non-zero when the tree is already gone -- not worth reporting.
      // But since it does, if that error isn't handled below, then the runner would terminate
      killer.on('error', () => { });
      killer.unref();
    } else {
      process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
    }

    return true;
  } catch {
    // ESRCH: the last member of the group exited before the signal landed. Nothing to do.
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
      partial = parts.pop() ?? '';
      for (const line of parts) push(truncate(line.replace(/\r$/, ''))); // regex strips hidden Windows-style line at end of text (\r)

      if (partial.length > MAX_LINE_CHARS) {
        push(truncate(partial));
        partial = '';
      }
    },

    peek(): string {
      const all = partial ? [...lines, truncate(partial)] : lines;
      return all.slice(-maxLines).join('\n');
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
