import prisma from '@/lib/prisma';
import { enqueuePipelineRun } from '@/lib/queue/runs';
import type { RunTrigger as PrismaRunTrigger } from '@/generated/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { ConfigJson, FormState, GraphJson, RunTrigger } from '../types';
import { getEnvironmentById } from '@/lib/data/environments';
import { validatePipelineGraph } from '@/lib/pipeline/validation';
import { addAudit } from './audits';
import { AuditAction, ResourceType } from '@/generated/prisma';

const RUN_NUMBER_ATTEMPTS = 3;

const TRIGGER_MAP: Record<RunTrigger, PrismaRunTrigger> = {
  webhook: 'WEBHOOK',
  manual: 'MANUAL',
  api: 'API'
}

/*
==============================================================================================
 * Enqueues a freshly created run, and takes the row back if the queue cannot be reached.
 *
 * Both triggers — addPipelineRun and retryRun — write the PipelineRun row first and enqueue
 * second. It leaves one window, though: If enqueuePipelineRun
 * throws — Redis down, REDIS_HOST unset — the caller's catch reports the failure to the user
 * and the row stays behind at QUEUED with no job that will ever reference it.
 * 
 * So if a run fails to enqueue, instead of making a newly QUEUED run, 
 * we delete it and notify the user that the job queue could not be reached.
==============================================================================================
*/
export async function enqueueOrDiscardRun(runId: string): Promise<boolean> {
  try {
    await enqueuePipelineRun(runId);
    return true;
  } catch (error: unknown) {
    console.error(
      `run ${runId} was created but could not be enqueued:`,
      error instanceof Error ? error.message : error,
    );

    try {
      const { pipelineId } = await prisma.pipelineRun.delete({ where: { id: runId } });
      await repointLastRun(pipelineId);
    } catch (cleanup: unknown) {
      console.error(
        `run ${runId} could not be discarded after the failed enqueue:`,
        cleanup instanceof Error ? cleanup.message : cleanup,
      );
    }
    return false;
  }
}

/*
==============================================================================================
 * When the last run of a pipeline gets deleted in `enqueueOrDiscardRun()`, 'lastRunId' gets set to NULL.
 * 
 * So get the run before that and update it as the pipeline's last run
==============================================================================================
*/
async function repointLastRun(pipelineId: string): Promise<void> {
  const latest = await prisma.pipelineRun.findFirst({
    select: { id: true },
    orderBy: { runNumber: 'desc' },
    where: { pipelineId },
  });

  if (!latest) return;

  await prisma.pipeline.updateMany({
    where: { id: pipelineId, lastRunId: null },
    data: { lastRunId: latest.id },
  });
}



export async function createPipelineRun(data: {
  pipelineId: string,
  definitionId: string,
  environmentId: string | null,
  trigger: RunTrigger,
  user: { id: string | null, name: string | null },
}): Promise<{ id: string, name: string, runNumber: number }> {
  const { user, trigger, ...runData } = data;

  for (let attempt = 1; attempt <= RUN_NUMBER_ATTEMPTS; attempt++) {
    try {
      const latest = await prisma.pipelineRun.findFirst({
        select: { runNumber: true },
        orderBy: { runNumber: 'desc' },
        where: { pipelineId: data.pipelineId }
      });

      return await prisma.$transaction(async (tx) => {
        /* Prevents another transaction from modifying the pipeline's lastRun by placing an exclusive lock on it. 
        The lock is released when the transaction ends. */
        await tx.$queryRaw`SELECT 1 FROM "pipelines" WHERE "id" = ${data.pipelineId} FOR UPDATE`;

        /* 
         * gets the name of the environment in case this new PipelineRun has an environmentId attached. 
         * This is to show that a run was originally executed with an environment, 
         * to prevent reruns that have deleted environment ids.
         */
        const environment = data.environmentId
          ? await tx.environment.findUnique({ where: { id: data.environmentId }, select: { name: true } })
          : null;

        const { id, runNumber, pipeline: { name } } = await tx.pipelineRun.create({
          select: { id: true, runNumber: true, pipeline: { select: { name: true } } },
          data: {
            ...runData,
            environmentName: environment?.name ?? null,
            triggeredById: user.id,
            trigger: TRIGGER_MAP[trigger],
            runNumber: (latest?.runNumber ?? 0) + 1
          },
        });

        // Points the pipeline's lastRun at the run that was just created, but only if that run's `runNumber` is greater than the current one.
        await tx.pipeline.updateMany({
          where: { 
            id: data.pipelineId, 
            OR: [
              { lastRunId: null }, 
              { lastRun: { runNumber: { lt: runNumber } } }
            ] 
          },
          data: { lastRunId: id },
        });

        await addAudit({
          userId: user.id,
          actor: user.name,
          action: AuditAction.RUN_TRIGGERED,
          resourceType: ResourceType.PIPELINE_RUN,
          resourceId: id,
          resourceLabel: name + ' #' + runNumber,
          resourceMeta: { kind: 'run', pipelineName: name, runNumber }
        }, tx);

        return { id, name, runNumber };
      });

    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
        && attempt < RUN_NUMBER_ATTEMPTS) continue;
      throw error;
    }
  }

  // TypeScript cannot prove the loop runs at all, so the function needs an exit here.
  throw new Error(`could not allocate a run number for pipeline ${data.pipelineId}`);
}



// The checks every trigger passes before a run row is written
export async function verifyPipelineRunReady(definition: { graphJson: GraphJson, configJson: ConfigJson }, environmentId: string | null): Promise<FormState> {
  const { graphJson, configJson } = definition;

  if (!graphJson.nodes.length) return {
    status: 'error',
    message: 'This pipeline has no stages. Add at least one.'
  }

  const environment = environmentId ? await getEnvironmentById(environmentId) : null;

  if (environmentId && !environment) return {
    status: 'error',
    message: 'The selected environment no longer exists. Pick another.'
  }

  const errors = validatePipelineGraph(graphJson, configJson, environment);

  if (errors.length) return {
    status: 'error',
    message: ['Cannot run pipeline:', ...errors.map(error => `• ${error}`)].join('\n')
  }

  return {
    status: 'success',
    message: ''
  }
}
