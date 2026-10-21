import { NextRequest, NextResponse } from "next/server";
import { getWebhookById } from "@/lib/data/webhooks";
import { decryptSecret, verifyWebhookSignature } from "@/lib/utils/crypto";
import { addWebhookEvent, updateWebhookEvent } from "@/lib/webhooks/webhook-events";
import { EventType, WebhookEventData, WebhookEventStatus } from "@/lib/types";
import { processDelivery } from "@/lib/webhooks/process-delivery";

// X-GitHub-Event header → the EventType a WebhookEvent row is stored under
const GITHUB_EVENT_MAP: Record<string, EventType> = {
  push: 'push',
  pull_request: 'pull-request',
  ping: 'ping',
};


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
    const outcome = await processDelivery(webhook, githubEvent, payload, { id: null, name: 'GitHub' });
    return await settle(outcome.status, outcome.reason, outcome.httpStatus, outcome.runId);

  } catch (error) {
    // The error itself goes to the server log, not the page: it can carry query or
    // connection details that have no business in the UI.
    console.error(`webhook event ${webhookEventId}:`, error);
    return await settle('failed', 'Could not process this delivery because of an unexpected error. Check the server logs.', 500);
  }

}