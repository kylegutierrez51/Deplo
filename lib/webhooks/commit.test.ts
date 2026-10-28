import { commitFromPayload, isForkPullRequest } from '@/lib/webhooks/commit';

/*
 * Pure file — no Prisma/auth mocks needed, since commit.ts imports neither lib/data nor
 * lib/actions.
 */

describe('commitFromPayload', () => {
  it('reads the pushed commit and strips refs/heads/ from the branch', () => {
    const payload = { ref: 'refs/heads/main', after: 'abc123' };

    expect(commitFromPayload('push', payload)).toEqual({ commitSha: 'abc123', branch: 'main' });
  });

  // The PR's own head is what gets built, not the base branch the branch filter checks
  // against, and not the base branch's name either.
  it('reads the PR head sha and head branch for a same-repo pull request', () => {
    const payload = {
      pull_request: { head: { sha: 'def456', ref: 'feature/login', repo: { full_name: 'org/repo' } } },
      repository: { full_name: 'org/repo' },
    };

    expect(commitFromPayload('pull_request', payload)).toEqual({ commitSha: 'def456', branch: 'feature/login' });
  });
});

describe('isForkPullRequest', () => {
  it('is false for a pull request from the same repo', () => {
    const payload = {
      pull_request: { head: { sha: 'def456', ref: 'feature/login', repo: { full_name: 'org/repo' } } },
      repository: { full_name: 'org/repo' },
    };

    expect(isForkPullRequest(payload)).toBe(false);
  });

  it('is true for a pull request whose head repo differs from the base repo', () => {
    const payload = {
      pull_request: { head: { sha: 'def456', ref: 'main', repo: { full_name: 'someone-else/repo' } } },
      repository: { full_name: 'org/repo' },
    };

    expect(isForkPullRequest(payload)).toBe(true);
  });

  // GitHub sends head.repo: null when the fork has since been deleted — still a fork.
  it('treats a deleted fork (head.repo null) as a fork', () => {
    const payload = {
      pull_request: { head: { sha: 'def456', ref: 'main', repo: null } },
      repository: { full_name: 'org/repo' },
    };

    expect(isForkPullRequest(payload)).toBe(true);
  });
});
