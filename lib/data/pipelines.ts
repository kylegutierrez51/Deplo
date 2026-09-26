import prisma from '@/lib/prisma';
import type { Pipeline as PrismaPipeline, RunStatus as PrismaRunStatus } from "@/generated/prisma/client";
import { fromDefinition } from '@/lib/pipeline/definition';
import type { GraphJson, PipelineStatus } from '@/lib/types';
import { ALL, PIPELINE_FILTERS, type PipelineFilters } from '@/lib/filters/options';
import { invert, parseFilters } from '@/lib/filters/parse';
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from '@/lib/utils/pagination';

export type Pipeline = Omit<PrismaPipeline, "createdById" | "lastRunId"> & {
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

const STATUS_TO_PRISMA = invert(RUN_STATUS_MAP);



/*
 Gets the pipelines with the filtered status. 

 We do this approach rather than just doing the following strategy: 
    1. 'runs: orderBy: { createdAt: "desc" }, take: 1'
    2. check if that run has the filtered status 

  because it breaks when pagination is added -- a page of 10 might filter to just 3 runs with the filtered status, even if 10+ runs have that status
*/
function statusWhere(status: PipelineFilters['status']) {
  if (status === ALL) return {};
  if (status === 'idle') return { lastRunId: null };
  return { lastRun: { status: STATUS_TO_PRISMA[status] } };
}

async function findPipelines(args: { where: ReturnType<typeof statusWhere>; skip?: number; take?: number }): Promise<Pipeline[]> {
  const pipelines = await prisma.pipeline.findMany({
    ...args,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { lastRun: true },
  });

  return pipelines.map(({ lastRun, lastRunId: _lastRunId, ...pipeline }) => ({
    ...pipeline,
    status: lastRun ? RUN_STATUS_MAP[lastRun.status] : 'idle',
    lastRun: lastRun?.id ?? null,
    runNumber: lastRun?.runNumber,
  }));
}

// Unpaginated: Used by WebhookModal so users can select pipelines
export async function getPipelines(filters: PipelineFilters = parseFilters({}, PIPELINE_FILTERS)): Promise<Pipeline[]> {
  return findPipelines({ where: statusWhere(filters.status) });
}

export async function getPipelinesPage(filters: PipelineFilters, page: number, pageSize = DEFAULT_PAGE_SIZE): Promise<Page<Pipeline>> {
  const where = statusWhere(filters.status);
  const total = await prisma.pipeline.count({ where });
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  return { rows: await findPipelines({ where, skip, take }), total, ...meta };
}

// the subtitle counts every pipeline regardless of filtering
export async function countPipelines(): Promise<number> {
  return prisma.pipeline.count();
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: {
      lastRun: true,
      createdBy: { select: { name: true } }
     }
  })

  if (!pipeline) return null;

  const { lastRun, lastRunId: _lastRunId, ...rest } = pipeline;

  return {
    ...rest,
    status: lastRun ? RUN_STATUS_MAP[lastRun.status] : 'idle',
    lastRun: lastRun?.id ?? null,
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