import { NextRequest, NextResponse } from "next/server";
import { getWebhookById } from "@/lib/data/webhooks";
import { decryptSecret, verifyWebhookSignature } from "@/lib/utils/crypto";
import { addWebhookEvent, updateWebhookEvent } from "@/lib/webhooks/webhook-events";
import { EventType, WebhookEventData } from "@/lib/types";
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

  try {
    if (githubEvent === 'ping') {
      console.log('GitHub sent the ping event');
      await updateWebhookEvent(webhookEventId, 'processed');
      return NextResponse.json({}, { status: 200 });
    }
    else if (githubEvent === 'push' || githubEvent === 'pull_request') {

      if (!webhook.events.includes(eventType)) {
        await updateWebhookEvent(webhookEventId, 'ignored');
        return NextResponse.json({ message: `This webhook is not subscribed to ${githubEvent} events.` }, { status: 200 });
      }

      // reject tag pushes (refs/tags/...) or a branch deletion
      if (githubEvent === 'push' && (!payload.ref.startsWith('refs/heads/') || payload.deleted)) {
        await updateWebhookEvent(webhookEventId, 'ignored');
        return NextResponse.json({ message: `Nothing to build for ${payload.ref}${payload.deleted ? ' (deleted)' : ''}.` }, { status: 200 });
      }

      if (githubEvent === 'pull_request' && !PR_ACTIONS.includes(payload.action)) {
        await updateWebhookEvent(webhookEventId, 'ignored');
        return NextResponse.json({ message: `Pull request action "${payload.action}" does not trigger a run.` }, { status: 200 });
      }

      if (githubEvent === 'pull_request' && isForkPullRequest(payload)) {
        await updateWebhookEvent(webhookEventId, 'ignored');
        return NextResponse.json({ message: "Pull requests from forks are not built: they would run untrusted code with this environment's secrets." }, { status: 200 });
      }

      // check for branch filters
      const target = githubEvent == 'push' ? payload.ref.replace('refs/heads/', '') : payload.pull_request.base.ref.replace('refs/heads/', '');
      console.log('targeted branch: ' + target);

      if (!checkBranches(target, webhook.branchFilters)) {
        await updateWebhookEvent(webhookEventId, 'ignored');

        return NextResponse.json({ message: `The target: (${target}) did not match the branch filters: (${webhook.branchFilters})` }, { status: 200 });
      }

      // the pipeline was deleted (SET NULL) or never chosen
      if (!webhook.pipelineId) {
        await updateWebhookEvent(webhookEventId, 'ignored');
        return NextResponse.json({ message: 'This webhook has no pipeline to run.' }, { status: 422 });
      }

      // From here on the delivery should have started a run, so anything that stops it is a failure
      const definition = await getLatestDefinition(webhook.pipelineId);
      if (!definition) {
        await updateWebhookEvent(webhookEventId, 'failed');
        return NextResponse.json({ message: 'The pipeline has no saved definition.' }, { status: 422 });
      }

      const isReadyState = await verifyPipelineRunReady(definition, webhook.environmentId);
      if (isReadyState.status === 'error') {
        await updateWebhookEvent(webhookEventId, 'failed');
        return NextResponse.json({ message: isReadyState.message }, { status: 422 });
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
        await updateWebhookEvent(webhookEventId, 'failed');
        return NextResponse.json({ error: 'Could not reach the job queue, so the run was not started.' }, { status: 503 });
      }

      await updateWebhookEvent(webhookEventId, 'processed', run.id);
      return NextResponse.json({ message: `Started ${run.name} #${run.runNumber}.` }, { status: 200 });
    }
    else {
      console.log(`Unhandled event: ${githubEvent}`)
      await updateWebhookEvent(webhookEventId, 'ignored');
    }
    
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error(`webhook event ${webhookEventId}:`, error);
    await updateWebhookEvent(webhookEventId, 'failed');
    return NextResponse.json({ error: 'Could not process this delivery.' }, { status: 500 });
  }

}