import { capitalize, getRepoName, getBranch, matchReservedLabel } from '@/lib/utils/string';

describe('capitalize', () => {
  it('uppercases the first character', () => {
    expect(capitalize('production')).toBe('Production');
  });

  it('leaves the rest of the string alone', () => {
    expect(capitalize('pull-request')).toBe('Pull-request');
  });

  it('is a no-op on an already capitalized value', () => {
    expect(capitalize('Deploy')).toBe('Deploy');
  });

  it('returns an empty string unchanged rather than throwing', () => {
    expect(capitalize('')).toBe('');
  });

  it('leaves a leading non-letter alone', () => {
    expect(capitalize('1st stage')).toBe('1st stage');
  });
});

describe('getRepoName', () => {
  it('takes the segment after the last slash', () => {
    expect(getRepoName('https://github.com/kylegutierrez51/deplo')).toBe('deplo');
  });

  it('returns the input unchanged when there is no slash', () => {
    expect(getRepoName('deplo')).toBe('deplo');
  });

  // TODO(bug): a .git suffix is not stripped, so a clone URL renders as
  // "deplo.git" in the UI. Pinned as-is; changing it is a display change.
  it('does not strip a .git suffix', () => {
    expect(getRepoName('https://github.com/kylegutierrez51/deplo.git')).toBe('deplo.git');
  });

  // TODO(bug): a trailing slash yields an empty name rather than the repo.
  it('yields an empty string for a trailing slash', () => {
    expect(getRepoName('https://github.com/kylegutierrez51/deplo/')).toBe('');
  });
});

describe('getBranch', () => {
  it('strips the refs/heads/ prefix', () => {
    expect(getBranch('refs/heads/main')).toBe('main');
  });

  it('keeps slashes inside the branch name', () => {
    expect(getBranch('refs/heads/feature/tests')).toBe('feature/tests');
  });

  // TODO(bug): this is a fixed slice(11) with no check that the ref actually
  // starts with refs/heads/. "refs/tags/" is only 10 characters, so a tag ref
  // loses its first character too and returns "1.0.0" rather than being
  // rejected. Pinned as-is.
  it('mangles a ref that is not a branch instead of rejecting it', () => {
    expect(getBranch('refs/tags/v1.0.0')).toBe('1.0.0');
  });

  it('returns an empty string for a ref shorter than the prefix', () => {
    expect(getBranch('refs/')).toBe('');
  });
});

describe('matchReservedLabel', () => {
  // StageTypeGrid labels deploy and approval stages itself, so a custom stage
  // claiming one of those words is what validation rejects.
  it.each(['approval', 'deploy'])('matches the reserved word %s', (word) => {
    expect(matchReservedLabel(word)).toBe(word);
  });

  it.each([
    ['capitalized', 'Deploy', 'deploy'],
    ['upper case', 'APPROVAL', 'approval'],
    ['mixed case', 'DePloY', 'deploy'],
    ['surrounded by whitespace', '  deploy  ', 'deploy'],
    ['both', '  ApPrOvAl ', 'approval'],
  ])('normalizes %s', (_label, input, expected) => {
    expect(matchReservedLabel(input)).toBe(expected);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['an unrelated word', 'build'],
    ['a word merely containing one', 'deployment'],
    ['a word merely prefixed by one', 'pre-deploy'],
  ])('returns null for %s', (_label, input) => {
    expect(matchReservedLabel(input)).toBeNull();
  });
});
