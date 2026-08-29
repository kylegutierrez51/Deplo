import prisma from '@/lib/prisma';
import type { Pipeline as PrismaPipeline, RunStatus as PrismaRunStatus } from "@/generated/prisma/client";
import { fromDefinition } from '@/lib/pipeline/definition';
import type { GraphJson, PipelineStatus } from '@/lib/types';

export type Pipeline = Omit<PrismaPipeline, "createdById"> & {
  lastRun: string | null;
  status: PipelineStatus;
  runNumber?: number;
  createdBy?: string | null;
  commitMessage?: string | null;
}

const RUN_STATUS_MAP: Record<PrismaRunStatus, PipelineStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
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
    status: runs[0] ? RUN_STATUS_MAP[runs[0].status] : 'idle',
    lastRun: runs[0]?.id ?? null,
    runNumber: runs[0]?.runNumber,
  }));
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      createdBy: { select: { name: true } }
     }
  })

  if (!pipeline) return null;

  return {
    ...pipeline,
    status: pipeline.runs[0] ? RUN_STATUS_MAP[pipeline.runs[0].status] : 'idle',
    lastRun: pipeline.runs[0]?.id ?? null,
    createdBy: pipeline.createdBy?.name ?? null
  }
}

export async function getPipelineDefinition(pipelineId: string): Promise<GraphJson> {
  const definition = await prisma.pipelineDefinition.findFirst({
    where: { pipelineId },
    orderBy: { version: 'desc' },
  });

  if (!definition) return { nodes: [], edges: [] };

  return fromDefinition(definition.graphJson, definition.configJson);
}