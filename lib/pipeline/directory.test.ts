import { splitDirectory, joinDirectory, withDefaultDirectory } from '@/lib/pipeline/directory';

/*
 * A stage's working directory has no field of its own: it rides at the front of
 * `command` as a `cd` prefix, so the runner needs no cwd plumbing and the command
 * a user reads in the editor is the command the shell receives.
 */

describe('splitDirectory', () => {
  it('returns the whole command as the body when there is no prefix', () => {
    expect(splitDirectory('npm run build')).toEqual({ directory: '', body: 'npm run build' });
  });

  it('reads the quoted prefix joinDirectory writes', () => {
    expect(splitDirectory('cd "/srv/my app" && npm ci')).toEqual({ directory: '/srv/my app', body: 'npm ci' });
  });

  it('reads the /d form written for a drive-letter path', () => {
    expect(splitDirectory('cd /d "D:\\work\\app" && npm ci')).toEqual({ directory: 'D:\\work\\app', body: 'npm ci' });
  });

  // An existing command written by hand before the field existed should land in it.
  it('reads an unquoted prefix typed by hand', () => {
    expect(splitDirectory('cd app && npm ci')).toEqual({ directory: 'app', body: 'npm ci' });
  });

  it('keeps a multi-line body intact', () => {
    expect(splitDirectory('cd "app" && npm ci\nnpm test')).toEqual({ directory: 'app', body: 'npm ci\nnpm test' });
  });

  it('reports an empty body for a directory with no command after it', () => {
    expect(splitDirectory('cd "app" && ')).toEqual({ directory: 'app', body: '' });
  });

  // Only the leading cd is the stage's directory; a later one is part of the script.
  it('takes only the first cd', () => {
    expect(splitDirectory('cd "a" && cd b && make')).toEqual({ directory: 'a', body: 'cd b && make' });
  });

  it('does not treat a bare cd with no && as a prefix', () => {
    expect(splitDirectory('cd app')).toEqual({ directory: '', body: 'cd app' });
  });
});

describe('joinDirectory', () => {
  it('returns the body alone when there is no directory', () => {
    expect(joinDirectory('', 'npm ci')).toBe('npm ci');
    expect(joinDirectory('   ', 'npm ci')).toBe('npm ci');
  });

  it('quotes a POSIX path', () => {
    expect(joinDirectory('/srv/my app', 'npm ci')).toBe('cd "/srv/my app" && npm ci');
  });

  // cmd.exe's plain cd will not switch drives, and /d is a syntax error to sh — so /d
  // is written only for a path that could only ever work on a Windows runner.
  it('adds /d for a drive-letter path', () => {
    expect(joinDirectory('D:\\work', 'npm ci')).toBe('cd /d "D:\\work" && npm ci');
  });

  // The input is derived from the command, so trimming here would eat the space the
  // user just typed in "my dir" before they reach the "d".
  it('keeps whitespace inside the directory while it is being typed', () => {
    expect(splitDirectory(joinDirectory('my ', 'npm ci')).directory).toBe('my ');
  });

  it('round-trips through splitDirectory', () => {
    const command = joinDirectory('C:\\a b', 'npm ci\nnpm test');
    expect(splitDirectory(command)).toEqual({ directory: 'C:\\a b', body: 'npm ci\nnpm test' });
  });
});

describe('withDefaultDirectory', () => {
  it('prepends the default to a command with no directory', () => {
    expect(withDefaultDirectory('npm ci', '/srv/app')).toBe('cd "/srv/app" && npm ci');
  });

  it('never overrides a directory the stage set itself', () => {
    expect(withDefaultDirectory('cd "own" && npm ci', '/srv/app')).toBe('cd "own" && npm ci');
  });

  it('leaves the command alone when there is no default', () => {
    expect(withDefaultDirectory('npm ci', null)).toBe('npm ci');
    expect(withDefaultDirectory('npm ci', '')).toBe('npm ci');
  });
});
