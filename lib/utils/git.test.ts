import { shortSha, commitSummary, getBranch, repoWebUrl, repoLabel } from '@/lib/utils/git';

describe('shortSha', () => {
  it('keeps the first seven characters, as git and GitHub abbreviate', () => {
    expect(shortSha('9e2a06f0970deb2b6b8aa7d91ec797e0ece667dd')).toBe('9e2a06f');
  });

  it('leaves an already short sha alone', () => {
    expect(shortSha('abc12')).toBe('abc12');
  });
});

describe('commitSummary', () => {
  it('returns a short subject unchanged', () => {
    expect(commitSummary('add bye message')).toBe('add bye message');
  });
  it('keeps only the subject line', () => {
    expect(commitSummary('Fix it\n\nLonger body')).toBe('Fix it');
  });

  it('drops a CRLF line ending with the body', () => {
    expect(commitSummary('Fix it\r\nbody')).toBe('Fix it');
  });

  it('truncates a long subject to thirty characters plus an ellipsis', () => {
    expect(commitSummary("feat: in 'create' mode, users can mask and copy a webhook secret"))
      .toBe("feat: in 'create' mode, users ...");
  });
});

describe('getBranch', () => {
  it('strips the refs/heads/ prefix', () => {
    expect(getBranch('refs/heads/main')).toBe('main');
  });

  it('keeps slashes inside the branch name', () => {
    expect(getBranch('refs/heads/feature/tests')).toBe('feature/tests');
  });
  it('returns a tag ref whole rather than mangling it into a branch name', () => {
    expect(getBranch('refs/tags/v1.0.0')).toBe('refs/tags/v1.0.0');
  });

  it('only strips the prefix at the start, not wherever it appears', () => {
    expect(getBranch('refs/tags/refs/heads/x')).toBe('refs/tags/refs/heads/x');
  });

  it('leaves an already bare branch name alone', () => {
    expect(getBranch('main')).toBe('main');
  });
});

describe('repoWebUrl', () => {
  it('returns an https url as-is', () => {
    expect(repoWebUrl('https://github.com/o/r')).toBe('https://github.com/o/r');
  });

  it('strips a .git suffix and a trailing slash', () => {
    expect(repoWebUrl('https://github.com/o/r.git')).toBe('https://github.com/o/r');
    expect(repoWebUrl('https://github.com/o/r/')).toBe('https://github.com/o/r');
  });

  it('turns an scp-style address into its https page', () => {
    expect(repoWebUrl('git@github.com:o/r.git')).toBe('https://github.com/o/r');
  });

  // The result lands in an href, so anything that is not one of the two cloneable shapes
  // gets no link rather than whatever scheme it happens to carry.
  it.each([
    ['a javascript: url', 'javascript:alert(1)'],
    ['plain http', 'http://github.com/o/r'],
    ['a bare name', 'deplo'],
  ])('returns null for %s', (_label, input) => {
    expect(repoWebUrl(input)).toBeNull();
  });
});

describe('repoLabel', () => {
  it('drops the scheme and host for a GitHub repo', () => {
    expect(repoLabel('https://github.com/kylegutierrez51/Deplo')).toBe('kylegutierrez51/Deplo');
  });

  it('labels an scp-style GitHub address the same way', () => {
    expect(repoLabel('git@github.com:kylegutierrez51/Deplo.git')).toBe('kylegutierrez51/Deplo');
  });

  // Only github.com is implied; any other host stays visible so the label is not ambiguous.
  it('keeps the host for anything other than github.com', () => {
    expect(repoLabel('https://gitlab.com/o/r')).toBe('gitlab.com/o/r');
  });

  it('falls back to the raw value when it cannot be parsed', () => {
    expect(repoLabel('deplo')).toBe('deplo');
  });
});
