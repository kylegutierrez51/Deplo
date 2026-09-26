import prisma from '@/lib/prisma';
import type { EventType } from '@/lib/types';
import type { EventType as PrismaEventType, Webhook as PrismaWebhook } from '@/generated/prisma';
import { ALL, WEBHOOK_FILTERS, type WebhookFilters } from '@/lib/filters/options';
import { parseFilters } from '@/lib/filters/parse';
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from '@/lib/utils/pagination';

const EVENT_TYPE_MAP: Record<PrismaEventType, EventType> = {
  PUSH: 'push',
  PULL_REQUEST: 'pull-request'
}
export type Webhook = Omit<PrismaWebhook, "createdById" | "events"> & {
  createdBy?: string | null;
  events: EventType[];
  pipelineName?: string | null;
}

export async function getWebhooksPage(filters: WebhookFilters = parseFilters({}, WEBHOOK_FILTERS), page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Page<Webhook>> {
  const { active, recency } = filters;
  const where = {
    ...(active !== ALL && { isActive: active === 'active' }),
  };
  const direction = recency === 'least-recent' ? 'asc' : 'desc';

  const total = await prisma.webhook.count({ where });
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  const webhooks = await prisma.webhook.findMany({
    where,
    skip,
    take,
    orderBy: [{ createdAt: direction }, { id: direction }],
    include: {
      pipeline: {
        select: { name: true }
      }
    }
  });

  const rows = webhooks.map((w) => ({
    ...w,
    events: w.events.map((event) => EVENT_TYPE_MAP[event]),
    pipelineName: w.pipeline?.name,
  }));
  return { rows, total, ...meta };
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