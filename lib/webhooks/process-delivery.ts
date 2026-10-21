import type { Webhook } from "@/lib/data/webhooks";
import type { WebhookEventStatus } from "@/lib/types";
import { checkBranches } from "@/lib/webhooks/branches";
import { commitFromPayload, isForkPullRequest } from "@/lib/webhooks/commit";
import { getLatestDefinition } from "@/lib/data/pipelines";
import { createPipelineRun, enqueueOrDiscardRun, verifyPipelineRunReady } from "@/lib/actions/run-trigger";

// pull_request actions that change what would be built
const PR_ACTIONS = ['opened', 'synchronize', 'reopened'];

export type DeliveryWebhook = Pick<Webhook, 'events' | 'branchFilters' | 'pipelineId' | 'environmentId'>;
export type DeliveryOutcome = { status: WebhookEventStatus, reason: string, httpStatus: number, runId?: string };

const outcome = (status: WebhookEventStatus, reason: string, httpStatus = 200, runId?: string): DeliveryOutcome =>
  ({ status, reason, httpStatus, ...(runId ? { runId } : {}) });

// Decides what a delivery does: ignore it, fail it, or start a run. Shared by the webhook
// route and replay. It does not catch errors; the caller settles an unexpected throw.
export async function processDelivery(
  webhook: DeliveryWebhook,
  githubEvent: string | null,
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- the route already treats it as untyped JSON
  triggeredBy: { id: string | null, name: string | null },
): Promise<DeliveryOutcome> {
  if (githubEvent === 'ping') {
    return outcome('processed', 'Ping received: GitHub can reach this webhook.');
  }
  else if (githubEvent === 'push' || githubEvent === 'pull_request') {
    const eventType = githubEvent === 'push' ? 'push' : 'pull-request';

    if (!webhook.events.includes(eventType)) {
      return outcome('ignored', `This webhook is not subscribed to ${githubEvent} events.`);
    }

    // reject tag pushes (refs/tags/...) or a branch deletion
    if (githubEvent === 'push' && (!payload.ref.startsWith('refs/heads/') || payload.deleted)) {
      return outcome('ignored', `Nothing to build for ${payload.ref}${payload.deleted ? ' (deleted)' : ''}.`);
    }

    if (githubEvent === 'pull_request' && !PR_ACTIONS.includes(payload.action)) {
      return outcome('ignored', `Pull request action "${payload.action}" does not trigger a run.`);
    }

    if (githubEvent === 'pull_request' && isForkPullRequest(payload)) {
      return outcome('ignored', "Pull requests from forks are not built: they would run untrusted code with this environment's secrets.");
    }

    // check for branch filters
    const target = githubEvent == 'push' ? payload.ref.replace('refs/heads/', '') : payload.pull_request.base.ref.replace('refs/heads/', '');

    if (!checkBranches(target, webhook.branchFilters)) {
      return outcome('ignored', `Branch "${target}" does not match the branch filters (${webhook.branchFilters.join(', ')}).`);
    }

    // the pipeline was deleted (SET NULL) or never chosen
    if (!webhook.pipelineId) {
      return outcome('ignored', 'This webhook has no pipeline to run.', 422);
    }

    // From here on the delivery should have started a run, so anything that stops it is a failure
    const definition = await getLatestDefinition(webhook.pipelineId);
    if (!definition) {
      return outcome('failed', 'The pipeline has no saved definition.', 422);
    }

    const isReadyState = await verifyPipelineRunReady(definition, webhook.environmentId);
    if (isReadyState.status === 'error') {
      return outcome('failed', isReadyState.message, 422);
    }

    const run = await createPipelineRun({
      pipelineId: webhook.pipelineId,
      environmentId: webhook.environmentId,
      definitionId: definition.id,
      user: triggeredBy,
      trigger: 'webhook',
      ...commitFromPayload(githubEvent, payload),
    });

    // If enqueue fails, deletes the run rather than leaving it stranded at QUEUED
    if (!await enqueueOrDiscardRun(run.id)) {
      return outcome('failed', 'Could not reach the job queue, so the run was not started.', 503);
    }

    return outcome('processed', `Started ${run.name} #${run.runNumber}.`, 200, run.id);
  }
  else {
    return outcome('ignored', `Deplo does not handle "${githubEvent ?? 'unknown'}" events.`);
  }
}
