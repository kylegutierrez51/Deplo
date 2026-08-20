import prisma from '@/lib/prisma';
import type { StageType as PrismaStageType, StageStatus as PrismaStageStatus } from '@/generated/prisma';
import type { EnvType } from '@/lib/types';
import { getDuration } from '@/lib/utils/date';

export type StageType = Lowercase<PrismaStageType>;
export type StageStatus = Lowercase<PrismaStageStatus>;

export type Approval = {
  id: string;
  stageId: string;
  runId: string;
  waitingTime: string;
  createdBy: string | null;
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


export async function getApprovals(): Promise<Approval[]> {
  const approvalStages = await prisma.stageResult.findMany({
    where: { stageType: 'APPROVAL', status: 'AWAITING_APPROVAL' },
    orderBy: { createdAt: 'asc' },
    include: { run: { include: approvalRunInclude } },
  });

  const commitMessageByRunId = await getCommitMessagesByRunId(approvalStages.map((a) => a.runId));

  return approvalStages.map((approvalStage) => {
    const { run } = approvalStage;

    const latestStages = new Map<string, PrismaStageStatus>(
      run.stages.map(s => [s.stageId, s.status])
    ); // includes only most recent attempt for each stage -- like loadRunContext() does

    return {
      id: approvalStage.id,
      stageId: approvalStage.stageId,
      runId: run.id,
      waitingTime: getDuration(approvalStage.startedAt ?? approvalStage.createdAt),
      createdBy: run.triggeredBy?.name ?? null,
      pipelineName: run.pipeline.name,
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
}
