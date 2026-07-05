import prisma from '@/lib/prisma';
import type { Webhook as PrismaWebhook } from '@/generated/prisma';

export type Webhook = Omit<PrismaWebhook, "createdById"> & {
  createdBy?: string | null;
  pipelineName?: string | null;
}

export async function getWebhooks(): Promise<Webhook[]> {
  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pipeline: {
        select: { name: true }
      }
    }
  });

  return webhooks.map((w) => ({
    ...w,
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
    pipelineName: webhook.pipeline?.name,
    createdBy: webhook.createdBy?.name ?? null,
  }
}