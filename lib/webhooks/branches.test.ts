import { checkBranches } from '@/lib/webhooks/branches';

/*
 * A filter matches the branch itself or anything beneath it, so "docs", "docs/"
 * and "docs/*" all select docs/env-test-example. The boundary is a '/': a filter
 * is a path prefix, not a string prefix, so "docs" must not select "docsite".
 *
 * The route strips refs/heads/ before calling this, so targets here are bare
 * branch names.
 */

describe('checkBranches', () => {
  it('matches every branch when there are no filters', () => {
    expect(checkBranches('main', [])).toBe(true);
    expect(checkBranches('docs/env-test-example', [])).toBe(true);
  });

  it('matches a branch named exactly by a filter', () => {
    expect(checkBranches('main', ['main'])).toBe(true);
  });

  it('rejects a branch no filter names', () => {
    expect(checkBranches('develop', ['main'])).toBe(false);
  });

  it.each(['docs', 'docs/', 'docs/*'])('matches docs/env-test-example against %p', (filter) => {
    expect(checkBranches('docs/env-test-example', [filter])).toBe(true);
  });

  it.each(['docs', 'docs/', 'docs/*'])('matches a nested branch under %p', (filter) => {
    expect(checkBranches('docs/guides/setup', [filter])).toBe(true);
  });

  // The prefix has to end at a '/', or "docs" would select every branch that
  // merely starts with those letters.
  it.each(['docsite', 'docs-old', 'documentation'])('does not match %p against "docs"', (target) => {
    expect(checkBranches(target, ['docs'])).toBe(false);
  });

  it.each(['docs/', 'docs/*'])('does not match "docsite" against %p', (filter) => {
    expect(checkBranches('docsite', [filter])).toBe(false);
  });

  // The filter is more specific than the target, so the target is not beneath it.
  it('does not match a branch that is only a prefix of the filter', () => {
    expect(checkBranches('release', ['release/v1'])).toBe(false);
    expect(checkBranches('doc', ['docs'])).toBe(false);
  });

  it('matches when any one of several filters matches', () => {
    expect(checkBranches('release/1.2', ['main', 'hotfix/', 'release/*'])).toBe(true);
  });

  it('rejects when none of several filters match', () => {
    expect(checkBranches('feature/login', ['main', 'hotfix/', 'release/*'])).toBe(false);
  });

  // Git branch names are case-sensitive.
  it('is case-sensitive', () => {
    expect(checkBranches('Main', ['main'])).toBe(false);
    expect(checkBranches('Docs/readme', ['docs/*'])).toBe(false);
  });

  it('does not match an unrelated branch that shares a later segment', () => {
    expect(checkBranches('feature/docs', ['docs'])).toBe(false);
  });
});
