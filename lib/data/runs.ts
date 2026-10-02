import prisma from "@/lib/prisma";
import type { RunStatus as PrismaRunStatus, RunTrigger as PrismaRunTrigger, PipelineRun as PrismaPipelineRun, EnvironmentType } from "@/generated/prisma";
import type { RunEnvironment, RunStatus, RunTrigger } from "@/lib/types";
import { toRunEnvironment } from "./run-environment";
import { ALL, RUN_FILTERS, type RunFilters } from "@/lib/filters/options";
import { invert, parseFilters } from "@/lib/filters/parse";
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from "@/lib/utils/pagination";

export type Run = Omit<PrismaPipelineRun, | 'triggeredById' | 'status' | 'trigger' | 'environmentName' | 'environmentType'> & {
  environment: RunEnvironment | null;
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

export async function getRunsPage(filters: RunFilters = parseFilters({}, RUN_FILTERS), page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Page<Run>> {
  const { status, trigger, environment, recency } = filters;
  const where = {
    ...(status !== ALL && { status: STATUS_TO_PRISMA[status] }),
    ...(trigger !== ALL && { trigger: TRIGGER_TO_PRISMA[trigger] }),
    ...(environment !== ALL && { environment: { type: environment.toUpperCase() as EnvironmentType } }),
  };
  const direction = recency === "least-recent" ? "asc" : "desc";

  const total = await prisma.pipelineRun.count({ where });
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  const runs = await prisma.pipelineRun.findMany({
    where,
    skip,
    take,
    orderBy: [{ createdAt: direction }, { id: direction }],
    include: {
      triggeredBy: { select: { name: true }},
      environment: { select: { name: true, type: true }},
      pipeline: { select: { name: true, repoUrl: true }}
    }
  });
  const rows = runs.map(({ environmentName: envName, environmentType: envType, ...run }) => ({
    ...run,
    environment: toRunEnvironment({ environment: run.environment, environmentName: envName, environmentType: envType }),
    pipelineName: run.pipeline?.name,
    repoUrl: run.pipeline?.repoUrl,
    triggeredBy: run.triggeredBy?.name,
    status: RUN_STATUS_MAP[run.status],
    trigger: RUN_TRIGGER_MAP[run.trigger]
  }));
  return { rows, total, ...meta };
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

  const { environmentName, environmentType, ...rest } = run;

  return {
    ...rest,
    environment: toRunEnvironment({ environment: run.environment, environmentName, environmentType }),
    pipelineName: run.pipeline?.name,
    repoUrl: run.pipeline?.repoUrl,
    triggeredBy: run.triggeredBy?.name,
    status: RUN_STATUS_MAP[run.status],
    trigger: RUN_TRIGGER_MAP[run.trigger]
  };
}