import prisma from "@/lib/prisma";
import type { RunStatus as PrismaRunStatus, RunTrigger as PrismaRunTrigger, PipelineRun as PrismaPipelineRun, EnvironmentType } from "@/generated/prisma";
import type { RunStatus, RunTrigger } from "@/lib/types";
import { ALL, RUN_FILTERS, type RunFilters } from "@/lib/filters/options";
import { invert, parseFilters } from "@/lib/filters/parse";

export type Run = Omit<PrismaPipelineRun, | 'triggeredById' | 'status' | 'trigger'> & {
  environment: {
    type: Lowercase<EnvironmentType>;
    name: string;
  } | null;
  pipelineName: string | null;
  repoUrl: string | null;
  triggeredBy?: string | null;
  status: RunStatus;
  trigger: RunTrigger
}

const RUN_STATUS_MAP: Record<PrismaRunStatus, RunStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const RUN_TRIGGER_MAP: Record<PrismaRunTrigger, RunTrigger> = {
  WEBHOOK: "webhook",
  MANUAL: "manual",
  API: "api"
};

const STATUS_TO_PRISMA = invert(RUN_STATUS_MAP);
const TRIGGER_TO_PRISMA = invert(RUN_TRIGGER_MAP);

export async function getRuns(filters: RunFilters = parseFilters({}, RUN_FILTERS)): Promise<Run[]> {
  const { status, trigger, environment, recency } = filters;

  const runs = await prisma.pipelineRun.findMany({
    where: {
      ...(status !== ALL && { status: STATUS_TO_PRISMA[status] }),
      ...(trigger !== ALL && { trigger: TRIGGER_TO_PRISMA[trigger] }),
      ...(environment !== ALL && { environment: { type: environment.toUpperCase() as EnvironmentType } }),
    },
    orderBy: { createdAt: recency === "least-recent" ? "asc" : "desc" },
    include: {
      triggeredBy: { select: { name: true }},
      environment: { select: { name: true, type: true }},
      pipeline: { select: { name: true, repoUrl: true }}
    }
  });
  return runs.map((run) => ({
    ...run,
    environment: run.environment ? {
      ...run.environment,
      type: run.environment.type.toLowerCase() as NonNullable<Run["environment"]>["type"],
    } : null,
    pipelineName: run.pipeline?.name,
    repoUrl: run.pipeline?.repoUrl,
    triggeredBy: run.triggeredBy?.name,
    status: RUN_STATUS_MAP[run.status],
    trigger: RUN_TRIGGER_MAP[run.trigger]
  }));
}

// Unfiltered on purpose: the page badge counts every active run regardless of filters
export async function countActiveRuns(): Promise<number> {
  return prisma.pipelineRun.count({ where: { status: "RUNNING" } });
}

export async function getRunById(id: string): Promise<Run | null> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id },
    include: {
      triggeredBy: { select: { name: true } },
      environment: { select: { type: true, name: true} },
      pipeline: { select: { name: true, repoUrl: true }}
    }
  });

  if (!run) return null;

  return {
    ...run,
    environment: run.environment ? {
      ...run.environment,
      type: run.environment.type.toLowerCase() as NonNullable<Run["environment"]>["type"],
    } : null,
    pipelineName: run.pipeline?.name,
    repoUrl: run.pipeline?.repoUrl,
    triggeredBy: run.triggeredBy?.name,
    status: RUN_STATUS_MAP[run.status],
    trigger: RUN_TRIGGER_MAP[run.trigger]
  };
}