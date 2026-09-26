import prisma from '@/lib/prisma';
import type { StageType as PrismaStageType, StageStatus as PrismaStageStatus, EnvironmentType } from '@/generated/prisma';
import { ALL, APPROVAL_FILTERS, type ApprovalFilters } from '@/lib/filters/options';
import { parseFilters } from '@/lib/filters/parse';
import type { EnvType } from '@/lib/types';
import { getDuration } from '@/lib/utils/date';
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from '@/lib/utils/pagination';

export type StageType = Lowercase<PrismaStageType>;
export type StageStatus = Lowercase<PrismaStageStatus>;

export type Approval = {
  id: string;
  stageId: string;
  runId: string;
  runNumber: number;
  waitingTime: string;
  createdBy: string | null;
  stageName: string;
  /* below come from runId in PipelineRun model */
  pipelineName: string;
  commitSha: string | null;
  commitMessage: string | null;
  environment: { type: EnvType; name: string } | null;
  branch: string | null;
  stagesComplete: string;
}

type GithubWebhookPayload = { head_commit?: { message?: string } };

// PipelineRun has no commitMessage column; WebhookEvent.runId links a
// delivery back to the run it triggered, so we recover the message from
// its payload when that link exists.
async function getCommitMessagesByRunId(runIds: string[]): Promise<Map<string, string | null>> {
  const webhookEvents = await prisma.webhookEvent.findMany({
    where: { runId: { in: runIds } },
  });

  return new Map(
    webhookEvents.map((event) => [
      event.runId as string,
      (event.payload as GithubWebhookPayload)?.head_commit?.message ?? null,
    ])
  );
}

const approvalRunInclude = {
  pipeline: { select: { name: true } },
  environment: { select: { type: true, name: true } },
  triggeredBy: { select: { name: true } },
  stages: { orderBy: [{ stageId: 'asc' as const }, { attempt: 'asc' as const }] },
};

const WAITING = { stageType: 'APPROVAL', status: 'AWAITING_APPROVAL' } as const;

export async function getApprovalsPage(filters: ApprovalFilters = parseFilters({}, APPROVAL_FILTERS), page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Page<Approval>> {
  const { environment, recency } = filters;
  const where = {
    ...WAITING,
    ...(environment !== ALL && { run: { environment: { type: environment.toUpperCase() as EnvironmentType } } }),
  };
  const direction = recency === 'most-recent' ? 'desc' : 'asc';

  const total = await prisma.stageResult.count({ where });
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  const approvalStages = await prisma.stageResult.findMany({
    where,
    skip,
    take,
    orderBy: [{ createdAt: direction }, { id: direction }],
    include: { run: { include: approvalRunInclude } },
  });

  const commitMessageByRunId = await getCommitMessagesByRunId(approvalStages.map((a) => a.runId))


  const rows = approvalStages.map((approvalStage) => {
    const { run } = approvalStage;

    const latestStages = new Map<string, PrismaStageStatus>(
      run.stages.map(s => [s.stageId, s.status])
    ); // includes only most recent attempt for each stage -- like loadRunContext() does

    return {
      id: approvalStage.id,
      stageId: approvalStage.stageId,
      runId: run.id,
      runNumber: run.runNumber,
      waitingTime: getDuration(approvalStage.startedAt ?? approvalStage.createdAt),
      createdBy: run.triggeredBy?.name ?? null,
      pipelineName: run.pipeline.name,
      stageName: approvalStage.stageName,
      commitSha: run.commitSha,
      commitMessage: commitMessageByRunId.get(run.id) ?? null,
      environment: run.environment ? {
        type: run.environment.type.toLowerCase() as EnvType,
        name: run.environment.name,
      } : null,
      branch: run.branch,
      stagesComplete: new Map([...latestStages].filter(([_, status]) => ["SUCCEEDED", "APPROVED"].includes(status))).size + '/' + latestStages.size
    };
  });
  return { rows, total, ...meta };
}

export type ApprovalStats = { pending: number; production: number; longestWait: string };

// Filters do not affect approval stat cards
export async function getApprovalStats(): Promise<ApprovalStats> {
  const [pending, production, oldest] = await Promise.all([
    prisma.stageResult.count({ where: WAITING }),
    prisma.stageResult.count({ where: { ...WAITING, run: { environment: { type: 'PRODUCTION' } } } }),
    prisma.stageResult.findFirst({
      where: WAITING,
      orderBy: { createdAt: 'asc' },
      select: { startedAt: true, createdAt: true },
    }),
  ]);

  return {
    pending,
    production,
    longestWait: oldest ? getDuration(oldest.startedAt ?? oldest.createdAt) : '0m',
  };
}
