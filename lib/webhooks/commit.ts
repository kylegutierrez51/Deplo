import { getBranch } from "@/lib/utils/git";
import { PushPayload, PullRequestPayload } from "@/lib/types";


// The commit a run should execute CI/CD pipeline. For a pull_request, that is the PR's own head
export function commitFromPayload(
  githubEvent: 'push' | 'pull_request',
  payload: PushPayload | PullRequestPayload,
): { commitSha: string; branch: string } {
  if (githubEvent === 'push') {
    const push = payload as PushPayload;
    return { commitSha: push.after, branch: getBranch(push.ref) };
  }

  const head = (payload as PullRequestPayload).pull_request.head;
  return { commitSha: head.sha, branch: head.ref };
}



/*
 * A fork PR's head commit is attacker-controlled: whoever opened it wrote the code that
 * would run with this environment's secrets. head.repo is null when the fork has since
 * been deleted, which is still a fork and must still be rejected.
 */
export function isForkPullRequest(payload: PullRequestPayload): boolean {
  return payload.pull_request.head.repo?.full_name !== payload.repository.full_name;
}
