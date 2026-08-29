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
import { CANCELLED_NOTE } from "@/lib/stage-notes";
import { Edge } from "@xyflow/react";

export type JobStatus = 'succeeded' | 'running' | 'queued' | 'pending' | 'failed' | 'cancelled' | 'awaiting-approval' | 'approved' | 'unapproved';

export type LogStatus = 'succeeded' | 'failed' | 'running' | 'cancelled';

export type LogLine = { lineNumber: number; content: string };

export type JobLog = {
  stageId: string;
  jobName: string;
  command: string;
  attempt: number;
  status: LogStatus;
  duration: string;
  lines: LogLine[];
};

export type LogFilters = {
  value: string; 
  label: string;
  status: JobStatus;
}

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

export type StageResultNode = Omit<CustomNode, 'data'> & {
  data: CustomNode['data'] & {
    duration: string;
    status: JobStatus;
    attempt: number;
    maxAttempts: number;
    secretKeys: string[];
  };
}

export type RunDetail = {
  runNumber: number;
  nodes: StageResultNode[],
  edges: Edge[],
  pipelineName: string;
  status: RunStatus;
  environment: { type: EnvType; name: string } | null;
  commitHash: string | null;
  commitMessage: string | null;
  branch: string | null;
  repo: string | null;
  trigger: RunTrigger;
  triggeredBy: string;
  duration: string;
  timeAgo: string;
  jobCounts: JobCounts;
  logFilters: LogFilters[];
  logs: JobLog[];
};

const RUN_STATUS_MAP: Record<PrismaRunStatus, RunStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const LOG_ELIGIBLE_STATUS: Partial<Record<PrismaStageStatus, LogStatus>> = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  RUNNING: 'running',
  CANCELLED: 'cancelled'
}

// stages previously running that got cancelled have concatenated '\n[run cancelled]" to the logSnippet. If that's the only line the logSnippet has, don't display the stage's logs.
export const hasReadableLogs = (logSnippet: string | null): boolean =>
  !!logSnippet && logSnippet.replace(CANCELLED_NOTE, '').trim().length > 0;

// needed since 'failQueuedStage()' marks a stage as 'FAILED' with no 'startedAt' date.
// the first condition allows 'running', 'succeeded', 'failed' stages. the 2nd allows 'cancelled' stages only if they have started and have logs.
const isLoggable = (status: PrismaStageStatus, hasStarted: boolean, hasLogs: boolean): boolean =>
  status !== 'CANCELLED' || (hasStarted && hasLogs);

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

export type StageLite = {
  stageId: string;
  startedAt: Date | null;
  logSnippet: string | null;
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

export function buildLogFilters(nodes: CustomNode[], stages: StageLite[]): LogFilters[] {
  const statusByStageId = new Map<string, LogStatus>();

  for (const stage of stages) {
    const status = LOG_ELIGIBLE_STATUS[stage.status];
    if (!status || !isLoggable(stage.status, !!stage.startedAt, hasReadableLogs(stage.logSnippet))) continue;
    statusByStageId.set(stage.stageId, status);
  }

  const filteredNodes: LogFilters[] = [];

  for (const node of nodes) {
    const status = statusByStageId.get(node.id);
    if (!status) continue;
    filteredNodes.push({ value: node.id, label: node.data.name ?? '', status });
  }

  return filteredNodes;
}

export function buildLogs(stages: StageResult[]): JobLog[] {
  const filteredStages = [];
  
  for (const stage of stages) {
    const status = LOG_ELIGIBLE_STATUS[stage.status];
    if (!status || !isLoggable(stage.status, !!stage.startedAt, hasReadableLogs(stage.logSnippet))) continue;
    filteredStages.push({ stage, status });
  }

  const loggedStages: JobLog[] = [];

  for (const { stage, status } of filteredStages) {
    const { stageId, stageName, command, attempt, startedAt, finishedAt, logSnippet } = stage;

    loggedStages.push({
      stageId: stageId,
      jobName: stageName, 
      command: command ?? '',
      attempt,
      status,
      duration: finishedAt
        ? getDuration(startedAt!, finishedAt)
        : startedAt
          ? getDuration(startedAt)
          : '—',
      lines: formatLines(logSnippet)
    });
  }

  return loggedStages;
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
      stages:  { orderBy: [{ stageId: 'asc' }, { attempt: 'asc' }] } // matches loadRunContext()
    },
  });

  if (!run) return undefined;

  const { nodes, edges } = fromDefinition(run.definition.graphJson, run.definition.configJson);

  const stagesLite: StageLite[] = run.stages.map((s) => ({
    stageId: s.stageId,
    startedAt: s.startedAt,
    logSnippet: s.logSnippet,
    status: s.status,
  }));

  const [commitMessage, secrets] = await Promise.all([
    getCommitMessage(run.id),
    run.environmentId
      ? prisma.secret.findMany({ where: { environmentId: run.environmentId }, select: { id: true, key: true } })
      : Promise.resolve([]),
  ]);

  const detailedNodes = addNodeDetails(
    nodes,
    run.stages,
    new Map(secrets.map((s) => [s.id, s.key])),
    run.environmentId,
  );

  return {
    runNumber: run.runNumber,
    nodes: detailedNodes,
    edges,
    pipelineName: run.pipeline.name,
    status: RUN_STATUS_MAP[run.status],
    environment: run.environment
      ? { type: run.environment.type.toLowerCase() as EnvType, name: run.environment.name }
      : null,
    commitHash: run.commitSha,
    commitMessage: commitMessage,
    branch: run.branch,
    repo: run.pipeline.repoUrl,
    trigger: RUN_TRIGGER_MAP[run.trigger],
    triggeredBy: run.triggeredBy?.name ?? '—',
    duration: run.finishedAt
      ? getDuration(run.startedAt!, run.finishedAt)
      : run.startedAt
        ? getDuration(run.startedAt)
        : '—',
    timeAgo: getDuration(run.createdAt),
    jobCounts: countJobs(nodes, stagesLite),
    logFilters: buildLogFilters(nodes.filter(n => n.data.type !== 'approval'), stagesLite),
    logs: buildLogs(run.stages)
  };
}

/*
==============================================================================================
 * Folds the per-attempt StageResult rows onto their graph nodes.
 *
 * stages arrives ordered [stageId asc, attempt asc], so building the Map is
 * last-write-wins and the row kept for a stageId is its *highest* attempt —
 * which is exactly the row `attempt`/`maxAttempts` should report.
 *
 * secretKeyById resolves node.data.secrets (which stores ids only) to keys.
 * environmentId is the run's own environment: the editor keeps stale entries
 * for previously selected environments, so only that key is read.
==============================================================================================
 */
export function addNodeDetails(
  nodes: CustomNode[],
  stages: StageResult[],
  secretKeyById: Map<string, string>,
  environmentId: string | null,
): StageResultNode[] {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));

  return nodes.map((node) => {
    const stage = stageByStageId.get(node.id);
    const secretIds = environmentId ? node.data.secrets?.[environmentId] ?? [] : [];

    return {
      ...node,
      data: {
        ...node.data,
        duration: stage?.startedAt ? getDuration(stage.startedAt, stage.finishedAt ?? undefined) : '—',
        status: stage ? STAGE_STATUS_TO_JOB_STATUS[stage.status] : 'pending',
        attempt: stage?.attempt ?? 1,
        // node.data.retries - falls back to the definition for a stage that doesn't have a stageResult row yet
        maxAttempts: (stage?.maxRetries ?? node.data.retries ?? 0) + 1,
        // A secret deleted after the run was triggered no longer resolves — drop it
        // rather than rendering a dangling id.
        secretKeys: secretIds.map((id) => secretKeyById.get(id)).filter((key): key is string => Boolean(key)),
      },
    };
  });
}

export function formatLines(logSnippet: string | null): LogLine[] {
  if (!logSnippet) return [];

  let start = 0;

  const lines: LogLine[] = [];

  for (let i = 0; i < logSnippet.length; i++) {
    if (logSnippet[i] === '\n') {
      lines.push({ lineNumber: lines.length + 1, content: logSnippet.slice(start, i)});
      start = i + 1;
    }
  }

  if (start < logSnippet.length) {
    lines.push({ lineNumber: lines.length + 1, content: logSnippet.slice(start)});
  }

  return lines;
}
