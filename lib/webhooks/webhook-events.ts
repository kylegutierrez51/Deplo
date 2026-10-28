import { EventType, WebhookEventStatus, WebhookEventData, FormState } from '@/lib/types';
import prisma from "@/lib/prisma";
import { Prisma } from '@/generated/prisma/client';
import { EventType as PrismaEventType, AuditAction, ResourceType, WebhookEventStatus as PrismaWebhookEventStatus } from '@/generated/prisma';
import { addAudit } from '@/lib/actions/audits';

const EVENT_TYPE_MAP: Record<EventType, PrismaEventType> = {
  push: 'PUSH',
  'pull-request': 'PULL_REQUEST',
  ping: 'PING',
  unrecognized: 'UNRECOGNIZED'
};

const STATUS_MAP: Record<WebhookEventStatus, PrismaWebhookEventStatus> = {
  'pending': 'PENDING',
  'processed': 'PROCESSED',
  'failed': 'FAILED',
  'ignored': 'IGNORED'
};


export async function addWebhookEvent(
  data: WebhookEventData,
  options: { replayedBy?: { id: string, name: string | null } } = {},
): Promise<FormState & { webhookEventId?: string }> {
  const { replayedBy } = options;
  try {
    const webhookEventId = await prisma.$transaction(async (tx) => {
      const { eventType, status, ...rest } = data;
      const { webhookId } = data;

      const event = await tx.webhookEvent.create({
        data: {
          ...rest,
          eventType: EVENT_TYPE_MAP[eventType],
          status: status ? STATUS_MAP[status] : 'PENDING',
          ...(replayedBy && { source: 'replay' }),
        },
        select: { id: true, pipeline: { select: { name: true } } }
      });

      // lastDelivery records GitHub's deliveries only; a replay is not one.
      if (!replayedBy) {
        await tx.webhook.update({
          where: { id: webhookId },
          data: { lastDelivery: new Date() }
        });
      }

      await addAudit({
        userId: replayedBy?.id ?? null,
        actor: replayedBy ? (replayedBy.name ?? null) : 'GitHub',
        action: replayedBy ? AuditAction.WEBHOOK_REPLAYED : AuditAction.WEBHOOK_RECEIVED,
        resourceType: ResourceType.WEBHOOK,
        resourceId: webhookId,
        resourceLabel: event.pipeline?.name ?? null
      }, tx);

      return event.id;
    });

    return {
      status: 'success',
      message: 'Webhook Event added',
      webhookEventId: webhookEventId
    };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        console.log(`${error.code}: ${error.message}`);
        // the create writes both foreign keys, so the violated field says which parent is gone
        const field = error.meta?.field_name;
        return {
          status: 'error',
          message: typeof field === 'string' && field.includes('webhookId')
            ? 'Webhook no longer exists.'
            : 'Pipeline associated with webhook no longer exists.'
        }
      }

      if (error.code === 'P2025') {
        console.log(`${error.code}: ${error.message}`);
        return {
          status: 'error',
          message: 'Webhook no longer exists.'
        }
      }

    }
    console.error(error);
    return {
      status: 'error',
      message: 'Error adding webhook event.',
    };
  }
}



/*
 * Settles an event: its status, a sentence saying why, and
 * the run it started, if any. 
 * An ignored event also loses its payload since it does nothing.
 */
export async function updateWebhookEvent(
  id: string,
  status: WebhookEventStatus,
  { reason, runId }: { reason: string, runId?: string },
): Promise<FormState> {
  try {
      await prisma.webhookEvent.update({
        where: { id },
        data: {
          status: STATUS_MAP[status],
          statusReason: reason,
          ...(runId && { runId }),
          ...(status === 'ignored' && { payload: Prisma.DbNull }),
        },
      });

      return {
        status: 'success',
        message: 'Webhook Event updated'
      };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'Webhook event not found'
      }
    }
    console.error(error);
    return {
      status: 'error',
      message: 'Error updating webhook event.',
    };
  }
}