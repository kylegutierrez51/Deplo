import { isCloneableRepoUrl, REPO_URL_ERROR } from './repo-url';

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
