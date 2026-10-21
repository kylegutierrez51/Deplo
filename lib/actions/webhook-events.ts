"use server"

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import type { EventType as PrismaEventType } from "@/generated/prisma";
import type { EventType, FormState, JSONObject, WebhookEventStatus } from "@/lib/types";
import { replayBlocker } from "@/lib/webhooks/replay";
import { processDelivery } from "@/lib/webhooks/process-delivery";
import { addWebhookEvent, updateWebhookEvent } from "@/lib/webhooks/webhook-events";

const EVENT_TYPE_MAP: Record<PrismaEventType, EventType> = {
  PING: 'ping',
  PUSH: 'push',
  PULL_REQUEST: 'pull-request',
  UNRECOGNIZED: 'unrecognized',
};

const UNEXPECTED_REPLAY_ERROR = 'Could not process this replay because of an unexpected error. Check the server logs.';

export async function replayWebhookEvent(id: string): Promise<FormState & { webhookEventId?: string, runId?: string, eventStatus?: WebhookEventStatus }> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to replay a webhook event.'
  }

  const replayedBy = { id: user.id, name: user.name ?? null };

  const event = await prisma.webhookEvent.findUnique({
    where: { id },
    select: {
      status: true, eventType: true, payload: true, headers: true,
      webhook: { select: { id: true, isActive: true, events: true, branchFilters: true, pipelineId: true, environmentId: true } }
    }
  });

  if (!event) return {
    status: 'error',
    message: 'This webhook event no longer exists.'
  }

  const blocker = replayBlocker(event);
  const { webhook } = event;
  // replayBlocker already covers a null webhook -- the `!webhook` is needed for TypeScript type checker
  if (blocker || !webhook) return { status: 'error', message: blocker ?? 'The webhook this event arrived on no longer exists.' };

  const eventType = EVENT_TYPE_MAP[event.eventType];
  const added = await addWebhookEvent(
    {
      eventType,
      payload: event.payload as JSONObject,
      headers: event.headers as JSONObject,
      webhookId: webhook.id,
      pipelineId: webhook.pipelineId
    },
    { replayedBy }
  );

  const newId = added.webhookEventId;
  if (!newId) return { status: 'error', message: added.message };

  let outcome;
  try {
    // Judged by the webhook's settings as they are now. That matters for a FAILED event once its cause
    // is fixed (a saved definition, a validation error, the queue back); a PROCESSED event may now be
    // ignored if the webhook changed. An event that missed a filter was IGNORED and has no payload.
    outcome = await processDelivery(
      {
        events: webhook.events.map((e) => EVENT_TYPE_MAP[e]),
        branchFilters: webhook.branchFilters,
        pipelineId: webhook.pipelineId,
        environmentId: webhook.environmentId
      },
      event.eventType === 'PUSH' ? 'push' : 'pull_request',
      event.payload,
      replayedBy
    );
  } catch (error) {
    console.error('Replay failed unexpectedly:', error);
    await updateWebhookEvent(newId, 'failed', { reason: UNEXPECTED_REPLAY_ERROR });
    return { status: 'error', message: UNEXPECTED_REPLAY_ERROR, webhookEventId: newId };
  }

  await updateWebhookEvent(newId, outcome.status, { reason: outcome.reason, runId: outcome.runId });
  revalidatePath('/webhooks/events');

  return {
    status: outcome.status === 'failed' ? 'error' : 'success',
    message: `Replayed: ${outcome.reason}`,
    webhookEventId: newId,
    runId: outcome.runId,
    eventStatus: outcome.status
  };
}
