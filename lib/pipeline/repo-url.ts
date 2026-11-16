// The repo URL is embedded literally, inside double quotes, in a shell command that runs
// under both cmd.exe and sh, and it is displayed on several pages. So it is restricted to
// characters neither shell interprets, and it may never carry credentials: no `user:pass@`
// part, and the only `@` allowed is the one in the scp-style `git@host:path` form.
const HOST = '[A-Za-z0-9.-]+';
const SEGMENT = '[A-Za-z0-9._~-]+';
// At least `owner/repo`, with no empty segments, and `.git` only as the final suffix.
// Owner is not the only prefix: GitLab nests groups (`group/subgroup/repo`).
const PATH = `(?!.*\\.git/.)${SEGMENT}(?:/${SEGMENT})+/?`;

const HTTPS_URL = new RegExp(`^https://${HOST}(:[0-9]+)?/${PATH}$`);
const SCP_URL = new RegExp(`^git@${HOST}:${PATH}$`);


export const REPO_URL_ERROR = 'Repo URL must be an https:// or git@ address with no username, password or special characters.';


export function isCloneableRepoUrl(url: string): boolean {
  return HTTPS_URL.test(url) || SCP_URL.test(url);
}


export function repoUrlWarning(pipelineName: string, repoUrl: string | null | undefined): string | null {
  if (repoUrl && isCloneableRepoUrl(repoUrl)) return null;
  return `${pipelineName} has no usable Repo URL, so webhook runs won't check out the pushed code. Add one in the pipeline's settings.`;
}
