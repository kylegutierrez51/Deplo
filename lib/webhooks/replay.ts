import type { WebhookEventStatus, EventType } from '@/generated/prisma';

// Why a stored event cannot be replayed, or null when it can. The first match wins, so
// the order is the order the reader should fix things in.
export function replayBlocker(event: {
  status: WebhookEventStatus,
  eventType: EventType,
  payload: unknown,
  webhook: { isActive: boolean } | null,
}): string | null {
  if (event.status === 'PENDING') return 'This event is still being processed.';
  if (event.eventType !== 'PUSH' && event.eventType !== 'PULL_REQUEST') return 'Only push and pull request events can be replayed.';
  if (event.payload === null || event.payload === undefined) return 'This event was ignored, so its payload was not kept and it cannot be replayed.';
  if (!event.webhook) return 'The webhook this event arrived on no longer exists.';
  if (!event.webhook.isActive) return 'This webhook is inactive. Activate it to replay its events.';
  return null;
}
