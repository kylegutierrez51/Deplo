import prisma from "@/lib/prisma";
import type {
  RunStatus as PrismaRunStatus,
  RunTrigger as PrismaRunTrigger,
  StageStatus as PrismaStageStatus,
  StageResult
} from "@/generated/prisma";
import type { RunStatus, RunTrigger, EnvType, CustomNode } from "@/lib/types";
import { getDuration } from "@/lib/utils/date";
import { fromDefinition } from "@/lib/pipeline/definition";
import { Edge } from "@xyflow/react";

export type JobStatus = 'succeeded' | 'running' | 'queued' | 'pending' | 'failed' | 'cancelled' | 'awaiting-approval' | 'approved' | 'unapproved';
export type LogStatus = 'succeeded' | 'failed' | 'running';

export type LogLine = { lineNumber: number; timestamp: string; content: string };

export type JobLog = {
  jobName: string;
  command: string;
  status: LogStatus;
  duration: string;
  lines: LogLine[];
};

export type JobCounts = {
  total: number;
  succeeded: number;
  running: number;
  queued: number;
  failed: number;
  cancelled: number;
  awaitingApproval: number;
  approved: number;
  unapproved: number;
};

type StageResultNode = Omit<CustomNode, 'data'> & {
  data: CustomNode['data'] & {
    duration: string;
    status: JobStatus;
  };
}

export type RunDetail = {
  runNumber: number;
  nodes: StageResultNode[],
  edges: Edge[],
  pipelineName: string;
  status: RunStatus;
  environment: { type: EnvType; name: string } | null;
  commitHash: string;
  commitMessage: string;
  branch: string;
  repo: string;
  trigger: RunTrigger;
  triggeredBy: string;
  duration: string;
  timeAgo: string;
  jobCounts: JobCounts;
  logFilters: { value: string; label: string }[];
};

const RUN_STATUS_MAP: Record<PrismaRunStatus, RunStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const RUN_TRIGGER_MAP: Record<PrismaRunTrigger, RunTrigger> = {
  WEBHOOK: 'webhook',
  MANUAL: 'manual',
  API: 'api',
};

const STAGE_STATUS_TO_JOB_STATUS: Record<PrismaStageStatus, JobStatus> = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  AWAITING_APPROVAL: 'awaiting-approval',
  APPROVED: 'approved',
  UNAPPROVED: 'unapproved',
  CANCELLED: 'cancelled',
};

const LOG_ELIGIBLE_STATUS: Partial<Record<PrismaStageStatus, LogStatus>> = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  RUNNING: 'running',
};

export type StageLite = {
  stageId: string;
  status: PrismaStageStatus;
};

export function countJobs(nodes: CustomNode[], stages: StageLite[]): JobCounts {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));
  const counts: JobCounts = { total: 0, succeeded: 0, running: 0, queued: 0, failed: 0, cancelled: 0, awaitingApproval: 0, approved: 0, unapproved: 0 };

  for (const node of nodes) {
    counts.total += 1;
    const stage = stageByStageId.get(node.id);

    if (!stage) continue;

    switch(stage.status) {
      case 'SUCCEEDED':
        counts.succeeded += 1; break;
      case 'RUNNING':
        counts.running += 1; break;
      case 'QUEUED':
        counts.queued += 1; break;
      case 'FAILED':
        counts.failed += 1; break;
      case 'CANCELLED':
        counts.cancelled += 1; break;
      case 'AWAITING_APPROVAL':
        counts.awaitingApproval += 1; break;
      case 'APPROVED':
        counts.approved += 1; break;
      case 'UNAPPROVED':
        counts.unapproved += 1; break;
    }
  }
  return counts;
}

/** One filter option per stage defined in graphJson, in pipeline order. */
export function buildLogFilters(nodes: CustomNode[], stages: StageLite[]): { value: string; label: string }[] {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));
  return nodes.map((node) => {
    const stage = stageByStageId.get(node.id);
    const status = stage ? STAGE_STATUS_TO_JOB_STATUS[stage.status] : 'pending';
    return { value: node.id, label: `${node.data.name ?? ''} - ${status}` };
  });
}

type StageForLogs = {
  stageName: string;
  command: string | null;
  logSnippet: string | null;
  status: PrismaStageStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/**
 * One JobLog per stage that has actually produced output (a command and/or
 * a logSnippet) and is in a terminal-or-running state. logSnippet has no
 * per-line timestamp data in the schema, so LogLine.timestamp is always ''.
 */
export function buildLogs(stages: StageForLogs[]): JobLog[] {
  return stages
    .filter((stage) => (stage.command || stage.logSnippet) && LOG_ELIGIBLE_STATUS[stage.status])
    .map((stage) => {
      const status = LOG_ELIGIBLE_STATUS[stage.status]!;
      const duration = stage.startedAt ? getDuration(stage.startedAt, stage.finishedAt ?? undefined) : '—';
      const lines: LogLine[] = (stage.logSnippet ?? '')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((content, index) => ({ lineNumber: index + 1, timestamp: '', content }));

      return {
        jobName: stage.stageName,
        command: stage.command ?? '',
        status,
        duration,
        lines,
      };
    });
}

type GithubWebhookPayload = { head_commit?: { message?: string } };

async function getCommitMessage(runId: string): Promise<string | null> {
  const webhookEvent = await prisma.webhookEvent.findFirst({ where: { runId } });
  return (webhookEvent?.payload as GithubWebhookPayload)?.head_commit?.message ?? null;
}

export async function getRunDetailById(id: string): Promise<RunDetail | undefined> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id },
    include: {
      pipeline: { select: { name: true, repoUrl: true } },
      environment: { select: { name: true, type: true } },
      triggeredBy: { select: { name: true } },
      definition: { select: { graphJson: true, configJson: true } },
      stages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!run) return undefined;

  const { nodes, edges } = fromDefinition(run.definition.graphJson, run.definition.configJson);

  const stagesLite: StageLite[] = run.stages.map((s) => ({
    stageId: s.stageId,
    status: s.status,
  }));

  const detailedNodes = addNodeDetails(nodes, run.stages);

  const [runNumber, commitMessage] = await Promise.all([
    prisma.pipelineRun.count({ where: { pipelineId: run.pipelineId, createdAt: { lte: run.createdAt } } }),
    getCommitMessage(run.id),
  ]);

  return {
    runNumber,
    nodes: detailedNodes,
    edges,
    pipelineName: run.pipeline.name,
    status: RUN_STATUS_MAP[run.status],
    environment: run.environment
      ? { type: run.environment.type.toLowerCase() as EnvType, name: run.environment.name }
      : null,
    commitHash: run.commitSha ?? '—',
    commitMessage: commitMessage ?? '—',
    branch: run.branch ?? '—',
    repo: run.pipeline.repoUrl,
    trigger: RUN_TRIGGER_MAP[run.trigger],
    triggeredBy: run.triggeredBy?.name ?? '—',
    duration: run.finishedAt
      ? getDuration(run.startedAt!, run.finishedAt)
      : run.startedAt
        ? getDuration(run.startedAt)
        : '—',
    timeAgo: getDuration(run.finishedAt ?? run.startedAt ?? run.createdAt),
    jobCounts: countJobs(nodes, stagesLite),
    logFilters: buildLogFilters(nodes, stagesLite),
  };
}

function addNodeDetails(nodes: CustomNode[], stages: StageResult[]): StageResultNode[] {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));

  return nodes.map((node) => {
    const stage = stageByStageId.get(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        duration: stage?.startedAt ? getDuration(stage.startedAt, stage.finishedAt ?? undefined) : '—',
        status: stage ? STAGE_STATUS_TO_JOB_STATUS[stage.status] : 'pending',
      },
    };
  });
}