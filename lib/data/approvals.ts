import prisma from '@/lib/prisma';
import type { StageType as PrismaStageType, StageStatus as PrismaStageStatus } from '@/generated/prisma';
import type { EnvType } from '@/lib/types';
import { getWaitingTime } from '@/lib/utils/date';

export type StageType = Lowercase<PrismaStageType>;
export type StageStatus = Lowercase<PrismaStageStatus>;

export type Stage = {
  id: string;
  stageType: StageType;
  status: StageStatus;
  name: string;
  isApproval?: boolean;
}

export type Approval = {
  id: string;
  runId: string;
  waitingTime: string;
  createdBy: string | null;
  /* below come from runId in PipelineRun model */
  pipelineName: string;
  commitSha: string | null;
  commitMessage: string | null;
  environment: EnvType;
  branch: string | null;

  /* below are stages */
  stages: Stage[];
}

// build -> hammer-outline
// test -> flask-outline
// deploy -> rocket-outline
// approval -> shield-outline
// script -> code-outline

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
  environment: { select: { type: true } },
  triggeredBy: { select: { name: true } },
  stages: { orderBy: { createdAt: 'asc' as const } },
};

export async function getApprovals(): Promise<Approval[]> {
  const approvalStages = await prisma.stageResult.findMany({
    where: { stageType: 'APPROVAL', status: 'AWAITING_APPROVAL' },
    orderBy: { createdAt: 'asc' },
    include: { run: { include: approvalRunInclude } },
  });

  const commitMessageByRunId = await getCommitMessagesByRunId(approvalStages.map((a) => a.runId));

  return approvalStages.map((approvalStage) => {
    const { run } = approvalStage;
    return {
      id: approvalStage.id,
      runId: run.id,
      waitingTime: getWaitingTime(approvalStage.createdAt),
      createdBy: run.triggeredBy?.name ?? null,
      pipelineName: run.pipeline.name,
      commitSha: run.commitSha,
      commitMessage: commitMessageByRunId.get(run.id) ?? null,
      environment: (run.environment?.type.toLowerCase() ?? 'development') as EnvType,
      branch: run.branch,
      stages: run.stages.map((stage) => ({
        id: stage.id,
        stageType: stage.stageType.toLowerCase() as StageType,
        status: stage.status.toLowerCase() as StageStatus,
        name: stage.stageName,
        isApproval: stage.stageType === 'APPROVAL',
      })),
    };
  });
}

export async function getApprovalById(id: string): Promise<Approval | null> {
  const approvalStage = await prisma.stageResult.findUnique({
    where: { id },
    include: { run: { include: approvalRunInclude } },
  });

  if (!approvalStage) return null;

  const commitMessageByRunId = await getCommitMessagesByRunId([approvalStage.runId]);
  const { run } = approvalStage;

  return {
    id: approvalStage.id,
    runId: run.id,
    waitingTime: getWaitingTime(approvalStage.createdAt),
    createdBy: run.triggeredBy?.name ?? null,
    pipelineName: run.pipeline.name,
    commitSha: run.commitSha,
    commitMessage: commitMessageByRunId.get(run.id) ?? null,
    environment: (run.environment?.type.toLowerCase() ?? 'development') as EnvType,
    branch: run.branch,
    stages: run.stages.map((stage) => ({
      id: stage.id,
      stageType: stage.stageType.toLowerCase() as StageType,
      status: stage.status.toLowerCase() as StageStatus,
      name: stage.stageName,
      isApproval: stage.stageType === 'APPROVAL',
    })),
  };
}