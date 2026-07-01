import prisma from '@/lib/prisma';
import type { Pipeline as PrismaPipeline, RunStatus } from "@/generated/prisma/client";
import { PipelineStatus } from '@/lib/types';

export type Pipeline = Omit<PrismaPipeline, "createdById"> & {
  lastRun: Date | null;
  status: PipelineStatus;
  createdBy?: string | null;
  commitMessage?: string | null;
}

const RUN_STATUS_MAP: Record<RunStatus, PipelineStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export async function getPipelines(): Promise<Pipeline[]> {
  const pipelines = await prisma.pipeline.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return pipelines.map(({ runs, ...pipeline }) => ({
    ...pipeline,
    status: runs[0] ? RUN_STATUS_MAP[runs[0].status] : 'idle', lastRun: runs[0] ? runs[0].finishedAt : null
  }));
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      }
     }
  })

  if (!pipeline) return null;

  return {
    ...pipeline,
    status: pipeline.runs[0] ? RUN_STATUS_MAP[pipeline.runs[0].status] : 'idle',
    lastRun: pipeline.runs[0] ? pipeline.runs[0].finishedAt : null
  }
}