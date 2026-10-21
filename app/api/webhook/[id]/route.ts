import { NextRequest, NextResponse } from "next/server";
import { getWebhookById } from "@/lib/data/webhooks";
import { decryptSecret, verifyWebhookSignature } from "@/lib/utils/crypto";
import { addWebhookEvent, updateWebhookEvent } from "@/lib/webhooks/webhook-events";
import { EventType, WebhookEventData, WebhookEventStatus } from "@/lib/types";
import { checkBranches } from "@/lib/webhooks/branches";
import { commitFromPayload, isForkPullRequest } from "@/lib/webhooks/commit";
import { getLatestDefinition } from "@/lib/data/pipelines";
import { createPipelineRun, enqueueOrDiscardRun, verifyPipelineRunReady } from "@/lib/actions/run-trigger";

// X-GitHub-Event header → the EventType a WebhookEvent row is stored under
const GITHUB_EVENT_MAP: Record<string, EventType> = {
  push: 'push',
  pull_request: 'pull-request',
  ping: 'ping',
};

// pull_request actions that change what would be built
const PR_ACTIONS = ['opened', 'synchronize', 'reopened'];


export async function POST(req: NextRequest, ctx: RouteContext<'/api/webhook/[id]'>) {
  const { id } = await ctx.params;

  const webhook = await getWebhookById(id);
  if (!webhook || !webhook.isActive) {
    console.log("webhook available: " + webhook?.createdAt);
    console.log("webhook active: " + webhook?.isActive);
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const text = await req.text(); // reads raw body — the signature covers these exact bytes

  const secret = decryptSecret(webhook);
  if (!verifyWebhookSignature(secret, text, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    // GitHub defaults a new webhook to application/x-www-form-urlencoded
    return NextResponse.json({ error: "Body is not JSON. Set the webhook's content type to application/json." }, { status: 400 });
  }

  const headers = {
    event: req.headers.get('x-github-event'),
    delivery: req.headers.get('x-github-delivery'),
  };

  const githubEvent = req.headers.get('x-github-event');

  const eventType = GITHUB_EVENT_MAP[githubEvent ?? ''] ?? 'unrecognized';

  const eventData: WebhookEventData = { eventType, payload, headers, webhookId: webhook.id, pipelineId: webhook.pipelineId };

  const { webhookEventId, ..._rest } = await addWebhookEvent(eventData);

  // A non-2xx marks the delivery failed in GitHub, where it can be redelivered
  if (!webhookEventId) return NextResponse.json({ error: _rest.message }, { status: 500 });

  // Records the outcome on the event and answers GitHub with the same sentence, so the
  // Webhook Events page and GitHub's Recent Deliveries always give the same reason.
  const settle = async (status: WebhookEventStatus, reason: string, httpStatus = 200, runId?: string) => {
    await updateWebhookEvent(webhookEventId, status, { reason, runId });
    return NextResponse.json({ message: reason }, { status: httpStatus });
  };

  try {
    if (githubEvent === 'ping') {
      console.log('GitHub sent the ping event');
      return await settle('processed', 'Ping received: GitHub can reach this webhook.');
    }
    else if (githubEvent === 'push' || githubEvent === 'pull_request') {

      if (!webhook.events.includes(eventType)) {
        return await settle('ignored', `This webhook is not subscribed to ${githubEvent} events.`);
      }

      // reject tag pushes (refs/tags/...) or a branch deletion
      if (githubEvent === 'push' && (!payload.ref.startsWith('refs/heads/') || payload.deleted)) {
        return await settle('ignored', `Nothing to build for ${payload.ref}${payload.deleted ? ' (deleted)' : ''}.`);
      }

      if (githubEvent === 'pull_request' && !PR_ACTIONS.includes(payload.action)) {
        return await settle('ignored', `Pull request action "${payload.action}" does not trigger a run.`);
      }

      if (githubEvent === 'pull_request' && isForkPullRequest(payload)) {
        return await settle('ignored', "Pull requests from forks are not built: they would run untrusted code with this environment's secrets.");
      }

      // check for branch filters
      const target = githubEvent == 'push' ? payload.ref.replace('refs/heads/', '') : payload.pull_request.base.ref.replace('refs/heads/', '');
      console.log('targeted branch: ' + target);

      if (!checkBranches(target, webhook.branchFilters)) {
        return await settle('ignored', `Branch "${target}" does not match the branch filters (${webhook.branchFilters.join(', ')}).`);
      }

      // the pipeline was deleted (SET NULL) or never chosen
      if (!webhook.pipelineId) {
        return await settle('ignored', 'This webhook has no pipeline to run.', 422);
      }

      // From here on the delivery should have started a run, so anything that stops it is a failure
      const definition = await getLatestDefinition(webhook.pipelineId);
      if (!definition) {
        return await settle('failed', 'The pipeline has no saved definition.', 422);
      }

      const isReadyState = await verifyPipelineRunReady(definition, webhook.environmentId);
      if (isReadyState.status === 'error') {
        return await settle('failed', isReadyState.message, 422);
      }

      const run = await createPipelineRun({
        pipelineId: webhook.pipelineId,
        environmentId: webhook.environmentId,
        definitionId: definition.id,
        user: { id: null, name: 'GitHub' },
        trigger: 'webhook',
        ...commitFromPayload(githubEvent, payload),
      });

      // If enqueue fails, deletes the run rather than leaving it stranded at QUEUED
      if (!await enqueueOrDiscardRun(run.id)) {
        return await settle('failed', 'Could not reach the job queue, so the run was not started.', 503);
      }

      return await settle('processed', `Started ${run.name} #${run.runNumber}.`, 200, run.id);
    }
    else {
      console.log(`Unhandled event: ${githubEvent}`)
      return await settle('ignored', `Deplo does not handle "${githubEvent ?? 'unknown'}" events.`);
    }

  } catch (error) {
    // The error itself goes to the server log, not the page: it can carry query or
    // connection details that have no business in the UI.
    console.error(`webhook event ${webhookEventId}:`, error);
    return await settle('failed', 'Could not process this delivery because of an unexpected error. Check the server logs.', 500);
  }

}