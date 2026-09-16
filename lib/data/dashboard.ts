import prisma from "@/lib/prisma";
import type { RunStatus as PrismaRunStatus, RunTrigger as PrismaRunTrigger } from "@/generated/prisma";
import type { EnvType, PipelineStatus, RunStatus, RunTrigger } from "@/lib/types";

export type DashboardRun = {
  id: string;
  pipelineName: string | null;
  status: RunStatus;
  trigger: RunTrigger;
  branch: string | null;
  commitSha: string | null;
  environment: { name: string; type: EnvType } | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

export type DashboardApproval = {
  id: string;
  runId: string;
  pipelineName: string;
  environment: { name: string; type: EnvType } | null;
  waitingSince: Date;
};

export type DashboardPipeline = {
  id: string;
  name: string;
  status: PipelineStatus;
  lastRun: Date | null;
};

export type DashboardData = {
  counts: {
    running: number;
    queued: number;
    awaitingApproval: number;
    failed7d: number;
  };
  week: {
    succeeded: number;
    failed: number;
    finished: number;
    successRate: number | null; // null when no finished runs this week
  };
  recentRuns: DashboardRun[];
  approvals: DashboardApproval[];
  moreApprovals: number; // pending approvals beyond the ones listed
  pipelines: DashboardPipeline[];
};

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
  API: "api",
};

const RECENT_RUNS_LIMIT = 8;
const APPROVALS_LIMIT = 4;
const PIPELINES_LIMIT = 5;

export async function getDashboardData(): Promise<DashboardData> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    running,
    queued,
    awaitingApproval,
    succeeded7d,
    failed7d,
    recentRuns,
    approvalStages,
    pipelines,
  ] = await Promise.all([
    prisma.pipelineRun.count({ where: { status: "RUNNING" } }),
    prisma.pipelineRun.count({ where: { status: "QUEUED" } }),
    prisma.stageResult.count({ where: { stageType: "APPROVAL", status: "AWAITING_APPROVAL" } }),
    prisma.pipelineRun.count({ where: { status: "SUCCEEDED", createdAt: { gte: weekAgo } } }),
    prisma.pipelineRun.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } }),
    prisma.pipelineRun.findMany({
      take: RECENT_RUNS_LIMIT,
      orderBy: { createdAt: "desc" },
      include: {
        pipeline: { select: { name: true } },
        environment: { select: { name: true, type: true } },
      },
    }),
    prisma.stageResult.findMany({
      where: { stageType: "APPROVAL", status: "AWAITING_APPROVAL" },
      orderBy: { createdAt: "asc" },
      take: APPROVALS_LIMIT,
      include: {
        run: {
          include: {
            pipeline: { select: { name: true } },
            environment: { select: { name: true, type: true } },
          },
        },
      },
    }),
    prisma.pipeline.findMany({
      take: PIPELINES_LIMIT,
      orderBy: { updatedAt: "desc" },
      include: {
        runs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const finished = succeeded7d + failed7d;

  return {
    counts: { running, queued, awaitingApproval, failed7d },
    week: {
      succeeded: succeeded7d,
      failed: failed7d,
      finished,
      successRate: finished > 0 ? Math.round((succeeded7d / finished) * 100) : null,
    },
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      pipelineName: run.pipeline?.name ?? null,
      status: RUN_STATUS_MAP[run.status],
      trigger: RUN_TRIGGER_MAP[run.trigger],
      branch: run.branch,
      commitSha: run.commitSha,
      environment: run.environment ? {
        name: run.environment.name,
        type: run.environment.type.toLowerCase() as EnvType,
      } : null,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
    })),
    approvals: approvalStages.map((stage) => ({
      id: stage.id,
      runId: stage.runId,
      pipelineName: stage.run.pipeline.name,
      environment: stage.run.environment ? {
        name: stage.run.environment.name,
        type: stage.run.environment.type.toLowerCase() as EnvType,
      } : null,
      waitingSince: stage.createdAt,
    })),
    moreApprovals: Math.max(0, awaitingApproval - approvalStages.length),
    pipelines: pipelines.map(({ runs, ...pipeline }) => ({
      id: pipeline.id,
      name: pipeline.name,
      status: runs[0] ? RUN_STATUS_MAP[runs[0].status] : 'idle',
      lastRun: runs[0] ? (runs[0].finishedAt ?? runs[0].createdAt) : null,
    })),
  };
}
