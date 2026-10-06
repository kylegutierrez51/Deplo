import prisma from '../prisma';
import type { WebhookEvent as PrismaWebhookEvent, WebhookEventStatus as PrismaWebhookEventStatus, EventType as PrismaEventType } from "@/generated/prisma";
import type { WebhookEventStatus, EventType } from '@/lib/types';
import { ALL, WEBHOOK_EVENT_FILTERS, type WebhookEventFilters } from '@/lib/filters/options';
import { invert, parseFilters } from '@/lib/filters/parse';
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from '@/lib/utils/pagination';

export type WebhookEvent = Omit<PrismaWebhookEvent, 'status' | 'eventType'> & {
  status: WebhookEventStatus;
  eventType: EventType;
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  pipeline: {
    name: string;
    repoUrl: string | null;
  } | null;
};

const WEBHOOK_EVENT_STATUS_MAP: Record<PrismaWebhookEventStatus, WebhookEventStatus> = {
  PENDING: "pending",
  PROCESSED: "processed",  
  IGNORED: "ignored",
  FAILED: "failed"
};

const WEBHOOK_EVENT_TYPE_MAP: Record<PrismaEventType, EventType> = {
  PUSH: "push",
  PULL_REQUEST: "pull-request",
  PING: 'ping',
  UNRECOGNIZED: 'unrecognized'
};

type GithubWebhookPayload = {
  after?: string;
  head_commit?: { message?: string };
  ref?: string;
};

export type WebhookEventCounts = Record<WebhookEventStatus, number>;

export type WebhookEventsPage = Page<WebhookEvent> & {
  counts: WebhookEventCounts;
};

const STATUS_TO_PRISMA = invert(WEBHOOK_EVENT_STATUS_MAP);
const EVENT_TYPE_TO_PRISMA = invert(WEBHOOK_EVENT_TYPE_MAP);

export async function getWebhookEventsPage(filters: WebhookEventFilters = parseFilters({}, WEBHOOK_EVENT_FILTERS), page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<WebhookEventsPage> {
  const { status, 'event-type': eventType, received } = filters;
  const where = {
    ...(status !== ALL && { status: STATUS_TO_PRISMA[status] }),
    ...(eventType !== ALL && { eventType: EVENT_TYPE_TO_PRISMA[eventType] })
  };

  const [total, statusCounts] = await Promise.all([
    prisma.webhookEvent.count({ where }),
    // the stat cards count every delivery, regardless of filters
    prisma.webhookEvent.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  const direction = received === 'least-recent' ? 'asc' : 'desc';

  const webhookEvents = await prisma.webhookEvent.findMany({
    where,
    skip,
    take,
    orderBy: [{ receivedAt: direction }, { id: direction }],
    include: {
      pipeline: { select: { name: true, repoUrl: true }},
    },
  });

  const counts: WebhookEventCounts = {
    pending: 0,
    processed: 0,
    ignored: 0,
    failed: 0,
  };
  for (const { status, _count } of statusCounts) {
    counts[WEBHOOK_EVENT_STATUS_MAP[status]] = _count;
  }

  return {
    total,
    ...meta,
    rows: webhookEvents.map((webhookEvent) => ({
      ...webhookEvent,
      pipeline: webhookEvent.pipeline ? {
        ...webhookEvent.pipeline,
      } : null,
      status: WEBHOOK_EVENT_STATUS_MAP[webhookEvent.status],
      eventType: WEBHOOK_EVENT_TYPE_MAP[webhookEvent.eventType],
      commitSha: (webhookEvent.payload as GithubWebhookPayload)?.after ?? null,
      commitMessage: (webhookEvent.payload as GithubWebhookPayload)?.head_commit?.message ?? null,
      branch: (webhookEvent.payload as GithubWebhookPayload)?.ref ?? null
    })),
    counts,
  };
}

export async function getWebhookEventById(id: string): Promise<WebhookEvent | null> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: { id },
    include: {
      pipeline: { select: { name: true, repoUrl: true }},      
    }
  });

  if (!webhookEvent) return null;

  return {
    ...webhookEvent,
    pipeline: webhookEvent.pipeline ? {
      ...webhookEvent.pipeline,
    } : null,
    status: WEBHOOK_EVENT_STATUS_MAP[webhookEvent.status],
    eventType: WEBHOOK_EVENT_TYPE_MAP[webhookEvent.eventType],
    commitSha: (webhookEvent.payload as GithubWebhookPayload)?.after ?? null,
    commitMessage: (webhookEvent.payload as GithubWebhookPayload)?.head_commit?.message ?? null,
    branch: (webhookEvent.payload as GithubWebhookPayload)?.ref ?? null
  }
}