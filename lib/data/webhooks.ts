import prisma from '@/lib/prisma';
import type { EventType } from '@/lib/types';
import type { EventType as PrismaEventType, Webhook as PrismaWebhook } from '@/generated/prisma';
import { ALL, WEBHOOK_FILTERS, type WebhookFilters } from '@/lib/filters/options';
import { parseFilters } from '@/lib/filters/parse';

const EVENT_TYPE_MAP: Record<PrismaEventType, EventType> = {
  PUSH: 'push',
  PULL_REQUEST: 'pull-request'
}
export type Webhook = Omit<PrismaWebhook, "createdById" | "events"> & {
  createdBy?: string | null;
  events: EventType[];
  pipelineName?: string | null;
}

export async function getWebhooks(filters: WebhookFilters = parseFilters({}, WEBHOOK_FILTERS)): Promise<Webhook[]> {
  const { active, recency } = filters;

  const webhooks = await prisma.webhook.findMany({
    where: {
      ...(active !== ALL && { isActive: active === 'active' }),
    },
    orderBy: { createdAt: recency === 'least-recent' ? 'asc' : 'desc' },
    include: {
      pipeline: {
        select: { name: true }
      }
    }
  });

  return webhooks.map((w) => ({
    ...w,
    events: w.events.map((event) => EVENT_TYPE_MAP[event]),
    pipelineName: w.pipeline?.name,
  }))
}

export async function getWebhookById(id: string): Promise<Webhook | null> {
  const webhook = await prisma.webhook.findUnique({
    where: { id },
    include: {
      pipeline: {
        select: { name: true }
      },
      createdBy: { select: { name: true }}
    }
  });

  if (!webhook) return null;

  return {
    ...webhook,
    events: webhook.events.map((event) => EVENT_TYPE_MAP[event]),
    pipelineName: webhook.pipeline?.name,
    createdBy: webhook.createdBy?.name ?? null,
  }
}