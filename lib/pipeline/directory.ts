/**
 * A stage's working directory, carried as a `cd` prefix on its command.
 *
 * Accepts `cd [/d] "<dir>" && ` (joinDirectory returns this format) and an unquoted
 * `cd <dir> && ` (what someone types by hand), so a command written before the
 * field existed still shows its directory in it.
 */
const PREFIX = /^cd\s+(?:\/d\s+)?(?:"([^"]*)"|([^\s"&]+))\s*&&\s*/i;

// if command uses a drive path, add 'cd /d' to beginning of it 
// drive paths are not used on macOS or Linux, only on Windows
const DRIVE_PATH = /^[A-Za-z]:/;

export function splitDirectory(command: string): { directory: string, body: string } {
  const match = PREFIX.exec(command);
  if (!match) return { directory: '', body: command };

  return { directory: match[1] ?? match[2], body: command.slice(match[0].length) };
}


export function joinDirectory(directory: string, body: string): string {
  if (!directory.trim()) return body;

  const cd = DRIVE_PATH.test(directory) ? 'cd /d' : 'cd';
  return `${cd} "${directory}" && ${body}`;
}


/** The command the runner executes: the pipeline default applies only when the stage sets no directory. */
export function withDefaultDirectory(command: string, defaultDirectory: string | null): string {
  if (!defaultDirectory || splitDirectory(command).directory) return command;
  return joinDirectory(defaultDirectory, command);
}
