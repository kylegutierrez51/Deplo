import prisma from '../prisma';
import type { WebhookEvent as PrismaWebhookEvent, WebhookEventStatus as PrismaWebhookEventStatus, EventType as PrismaEventType } from "@/generated/prisma";
import type { WebhookEventStatus, EventType } from '@/lib/types';
import { ALL, WEBHOOK_EVENT_FILTERS, type WebhookEventFilters } from '@/lib/filters/options';
import { invert, parseFilters } from '@/lib/filters/parse';

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
  PULL_REQUEST: "pull-request"
};

type GithubWebhookPayload = {
  after?: string;
  head_commit?: { message?: string };
  ref?: string;
};

export type WebhookEventCounts = Record<WebhookEventStatus, number>;

export type WebhookEventsResult = {
  events: WebhookEvent[];
  counts: WebhookEventCounts;
};

const STATUS_TO_PRISMA = invert(WEBHOOK_EVENT_STATUS_MAP);
const EVENT_TYPE_TO_PRISMA = invert(WEBHOOK_EVENT_TYPE_MAP);


export async function getWebhookEvents(filters: WebhookEventFilters = parseFilters({}, WEBHOOK_EVENT_FILTERS)): Promise<WebhookEventsResult> {
  const { status, 'event-type': eventType } = filters;

  const [webhookEvents, statusCounts] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: {
        ...(status !== ALL && { status: STATUS_TO_PRISMA[status] }),
        ...(eventType !== ALL && { eventType: EVENT_TYPE_TO_PRISMA[eventType] }),
      },
      orderBy: { receivedAt: "desc" },
      include: {
        pipeline: { select: { name: true, repoUrl: true }},
      },
    }),
    prisma.webhookEvent.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

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
    events: webhookEvents.map((webhookEvent) => ({
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