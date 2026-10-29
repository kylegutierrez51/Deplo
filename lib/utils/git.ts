import { truncateText } from './string';


const SHORT_SHA_LENGTH = 7;
const COMMIT_SUMMARY_LENGTH = 30;
const BRANCH_REF_PREFIX = 'refs/heads/';

// The two shapes isCloneableRepoUrl accepts, with an optional .git suffix and trailing slash.
const HTTPS_REPO = /^https:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/;
const SCP_REPO = /^git@([^:]+):(.+?)(?:\.git)?\/?$/;


export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}


// The subject line only, truncated
export function commitSummary(message: string): string {
  const subject = message.split('\n', 1)[0].trim();
  return truncateText(subject, COMMIT_SUMMARY_LENGTH) ?? '';
}



// The branch a push's ref names. Only `refs/heads/` is a branch, not `refs/tags/v1`
export function getBranch(ref: string): string {
  return ref.startsWith(BRANCH_REF_PREFIX) ? ref.slice(BRANCH_REF_PREFIX.length) : ref;
}


function parseRepo(repoUrl: string): { host: string; path: string } | null {
  const match = HTTPS_REPO.exec(repoUrl) ?? SCP_REPO.exec(repoUrl);
  return match ? { host: match[1], path: match[2] } : null;
}


// The repo's browsable https page, or null for anything that is not a cloneable address.
export function repoWebUrl(repoUrl: string): string | null {
  const repo = parseRepo(repoUrl);
  return repo ? `https://${repo.host}/${repo.path}` : null;
}


// returns `<owner>/repo` for GitHub
export function repoLabel(repoUrl: string): string {
  const repo = parseRepo(repoUrl);
  if (!repo) return repoUrl;
  return repo.host === 'github.com' ? repo.path : `${repo.host}/${repo.path}`;
}


// The bare repo name, without its owner, a .git suffix or a trailing slash
export function repoName(repoUrl: string): string {
  const repo = parseRepo(repoUrl);
  if (!repo) return repoUrl;
  return repo.path.slice(repo.path.lastIndexOf('/') + 1);
}
