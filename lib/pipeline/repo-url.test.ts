import { isCloneableRepoUrl, REPO_URL_ERROR, repoUrlWarning } from './repo-url';

describe('isCloneableRepoUrl', () => {
  it.each([
    'https://github.com/org/repo',
    'https://github.com/org/repo.git',
    'https://git.example.com:8443/team/repo.git',
    'git@github.com:org/repo.git',
  ])('accepts %s', (url) => {
    expect(isCloneableRepoUrl(url)).toBe(true);
  });

  it.each([
    'http://github.com/org/repo',
    'https://user:tok@github.com/org/repo',
    'https://github.com/org/$(id)',
    'https://github.com/org/repo"',
    'https://github.com/org/re po',
    'https://github.com/org/%PATH%',
    'file:///tmp/repo',
    '',
    'https://github.com/org/repo\n',
    'git@github.com:org/repo;id',
  ])('rejects %j', (url) => {
    expect(isCloneableRepoUrl(url)).toBe(false);
  });

  it('exposes a message for the save error', () => {
    expect(REPO_URL_ERROR).toBe('Repo URL must be an https:// or git@ address with no username, password or special characters.');
  });
});

describe('repoUrlWarning', () => {
  it('says nothing for a cloneable URL', () => {
    expect(repoUrlWarning('deploy-api', 'https://github.com/org/repo')).toBeNull();
  });

  it.each([null, undefined, ''])('warns that %p means no Repo URL', repoUrl => {
    expect(repoUrlWarning('deploy-api', repoUrl)).toBe(
      "deploy-api has no usable Repo URL, so webhook runs won't check out the pushed code. Add one in the pipeline's settings."
    );
  });

  // Stored before validation existed: present, but the Checkout stage skips it just the same.
  it('warns that an unusable URL cannot be checked out', () => {
    expect(repoUrlWarning('deploy-api', 'https://user:tok@github.com/org/repo')).toBe(
      "deploy-api has no usable Repo URL, so webhook runs won't check out the pushed code. Add one in the pipeline's settings."
    );
  });
});
