import prisma from "@/lib/prisma";
import type {
  RunStatus as PrismaRunStatus,
  RunTrigger as PrismaRunTrigger,
  StageStatus as PrismaStageStatus,
} from "@/generated/prisma";
import type { RunStatus, RunTrigger, EnvType } from "@/lib/types";
import { getDuration } from "@/lib/utils/date";

export type JobStatus = 'succeeded' | 'failed' | 'running' | 'queued' | 'pending' | 'cancelled';
export type LogStatus = 'succeeded' | 'failed' | 'running';

export type RunJob = {
  name: string;
  status: JobStatus;
  duration?: string;
  isActive?: boolean;
};

export type RunGraphNode =
  | ({ type: 'job' } & RunJob)
  | { type: 'connector-straight'; active?: boolean }
  | { type: 'connector-fork' }
  | { type: 'connector-merge' }
  | { type: 'parallel'; jobs: RunJob[] };

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
  awaitingApproval: number;
};

export type RunDetail = {
  runNumber: number;
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
  graph: RunGraphNode[];
  logFilters: { value: string; label: string }[];
  logs: JobLog[];
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

// AWAITING_APPROVAL displays as 'pending' in the graph (it isn't a distinct
// icon state); jobCounts.awaitingApproval is tallied separately from the raw
// StageStatus in countJobs below.
const STAGE_STATUS_TO_JOB_STATUS: Record<PrismaStageStatus, JobStatus> = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  AWAITING_APPROVAL: 'pending',
  APPROVED: 'succeeded',
  UNAPPROVED: 'failed',
  CANCELLED: 'cancelled',
};

const LOG_ELIGIBLE_STATUS: Partial<Record<PrismaStageStatus, LogStatus>> = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  RUNNING: 'running',
};

// Shape of PipelineDefinition.graphJson, as written by lib/pipeline-definition.ts
// and prisma/seed.ts's buildDefinition(): a chain of stage nodes connected by
// edges. `name` is the stage name; `label` is a free-text tag the editor shows on
// the node's card, so it is not a display name here.
export type GraphJsonNode = { id: string; type: string; data: { label?: string; name?: string } };
export type GraphJsonEdge = { id: string; source: string; target: string };
export type GraphJson = { nodes: GraphJsonNode[]; edges: GraphJsonEdge[] };

export type StageLite = {
  stageId: string;
  status: PrismaStageStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/**
 * Walks graphJson's nodes/edges to produce the linear job/connector sequence
 * PipelineGraph renders. Stages with no matching StageResult row (not yet
 * started) render as 'pending'. Branches are assumed to be exactly one stage
 * deep before reconverging — the only shape this schema's simple stage-chain
 * graphJson format actually produces (see prisma/seed.ts); today's seed data
 * never branches at all, so in practice this only emits job/connector-straight.
 */
export function buildGraph(graphJson: GraphJson, stages: StageLite[]): RunGraphNode[] {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));
  const nodeById = new Map(graphJson.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of graphJson.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  function statusOf(id: string): JobStatus {
    const stage = stageByStageId.get(id);
    return stage ? STAGE_STATUS_TO_JOB_STATUS[stage.status] : 'pending';
  }

  function toJob(id: string): RunJob {
    const node = nodeById.get(id)!;
    const stage = stageByStageId.get(id);
    const duration = stage?.startedAt
      ? getDuration(stage.startedAt, stage.finishedAt ?? undefined)
      : undefined;
    return { name: node.data.name ?? '', status: statusOf(id), duration };
  }

  // The connector leading into the first currently-running stage is drawn
  // highlighted, matching the pipeline's "you are here" indicator.
  const activeId = graphJson.nodes.map((n) => n.id).find((id) => statusOf(id) === 'running');

  const result: RunGraphNode[] = [];
  const visited = new Set<string>();
  let frontier = graphJson.nodes.map((n) => n.id).filter((id) => !incoming.has(id));

  while (frontier.length > 0 && !frontier.every((id) => visited.has(id))) {
    if (frontier.length === 1) {
      const [id] = frontier;
      visited.add(id);
      result.push({ type: 'job', ...toJob(id) });

      const next = outgoing.get(id) ?? [];
      if (next.length > 1) {
        result.push({ type: 'connector-fork' });
        frontier = next;
      } else if (next.length === 1) {
        result.push({ type: 'connector-straight', active: next[0] === activeId });
        frontier = next;
      } else {
        frontier = [];
      }
    } else {
      frontier.forEach((id) => visited.add(id));
      const jobs = frontier.map((id) => toJob(id));
      result.push({ type: 'parallel', jobs });

      const mergeTargets = [...new Set(frontier.flatMap((id) => outgoing.get(id) ?? []))];
      if (mergeTargets.length > 0) {
        result.push({ type: 'connector-merge' });
      }
      frontier = mergeTargets;
    }
  }

  return result;
}

/**
 * Tallies every stage defined in graphJson (including ones with no
 * StageResult row yet, i.e. not started) into the Pill counts shown above
 * the pipeline graph. PENDING stages count only toward `total`.
 */
export function countJobs(graphJson: GraphJson, stages: StageLite[]): JobCounts {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));
  const counts: JobCounts = { total: 0, succeeded: 0, running: 0, queued: 0, failed: 0, awaitingApproval: 0 };

  for (const node of graphJson.nodes) {
    counts.total += 1;
    const stage = stageByStageId.get(node.id);
    if (!stage) continue;

    if (stage.status === 'AWAITING_APPROVAL') {
      counts.awaitingApproval += 1;
    } else if (stage.status === 'SUCCEEDED' || stage.status === 'APPROVED') {
      counts.succeeded += 1;
    } else if (stage.status === 'RUNNING') {
      counts.running += 1;
    } else if (stage.status === 'QUEUED') {
      counts.queued += 1;
    } else if (stage.status === 'FAILED' || stage.status === 'UNAPPROVED' || stage.status === 'CANCELLED') {
      counts.failed += 1;
    }
  }

  return counts;
}

/** One filter option per stage defined in graphJson, in pipeline order. */
export function buildLogFilters(graphJson: GraphJson, stages: StageLite[]): { value: string; label: string }[] {
  const stageByStageId = new Map(stages.map((s) => [s.stageId, s]));
  return graphJson.nodes.map((node) => {
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
      definition: { select: { graphJson: true } },
      stages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!run) return undefined;

  const graphJson = run.definition.graphJson as unknown as GraphJson;
  const stagesLite: StageLite[] = run.stages.map((s) => ({
    stageId: s.stageId,
    status: s.status,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
  }));

  const [runNumber, commitMessage] = await Promise.all([
    prisma.pipelineRun.count({ where: { pipelineId: run.pipelineId, createdAt: { lte: run.createdAt } } }),
    getCommitMessage(run.id),
  ]);

  return {
    runNumber,
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
    jobCounts: countJobs(graphJson, stagesLite),
    graph: buildGraph(graphJson, stagesLite),
    logFilters: buildLogFilters(graphJson, stagesLite),
    logs: buildLogs(run.stages),
  };
}
