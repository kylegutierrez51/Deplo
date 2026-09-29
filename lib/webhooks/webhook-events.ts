import { EventType, WebhookEventStatus, WebhookEventData, FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
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


export async function addWebhookEvent(data: WebhookEventData): Promise<FormState & { webhookEventId?: string }> {
  try {
    const webhookEventId = await prisma.$transaction(async (tx) => {
      const { eventType, status, webhookId,  ...rest} = data;

      const event = await tx.webhookEvent.create({
        data: { ...rest, eventType: EVENT_TYPE_MAP[eventType], status: status ? STATUS_MAP[status] : 'PENDING' },
        select: { id: true, pipeline: { select: { name: true } } }
      });

      await tx.webhook.update({
        where: { id: webhookId },
        data: { lastDelivery: new Date() }
      })

      await addAudit({
        userId: null,
        actor: 'GitHub',
        action: AuditAction.WEBHOOK_RECEIVED,
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
        return {
          status: 'error',
          message: 'Pipeline associated with webhook no longer exists.'
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



export async function updateWebhookEvent(id: string, status: WebhookEventStatus, runId?: string): Promise<FormState> {
  try {
      await prisma.webhookEvent.update({
        where: { id },
        data: { status: STATUS_MAP[status] },
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