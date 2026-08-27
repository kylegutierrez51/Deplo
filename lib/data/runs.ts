import prisma from "@/lib/prisma";
import type { RunStatus as PrismaRunStatus, RunTrigger as PrismaRunTrigger, PipelineRun as PrismaPipelineRun, EnvironmentType } from "@/generated/prisma";
import type { RunStatus, RunTrigger } from "@/lib/types";

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

export async function getRuns(): Promise<Run[]> {
  const runs = await prisma.pipelineRun.findMany({
    orderBy: { createdAt: "desc" },
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