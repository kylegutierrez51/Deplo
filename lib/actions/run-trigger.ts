import prisma from '@/lib/prisma';
import { enqueuePipelineRun } from '@/lib/queue/runs';
import type { RunTrigger as PrismaRunTrigger } from '@/generated/prisma';
import { Prisma } from '@/generated/prisma/client';
import type { RunTrigger } from '../types';

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
      await prisma.pipelineRun.delete({ where: { id: runId } });
    } catch (cleanup: unknown) {
      console.error(
        `run ${runId} could not be discarded after the failed enqueue:`,
        cleanup instanceof Error ? cleanup.message : cleanup,
      );
    }

    return false;
  }
}

export async function createPipelineRun(data: {
  pipelineId: string,
  definitionId: string,
  trigger: RunTrigger,
  triggeredById: string,
  environmentId: string | null
}): Promise<{ id: string }> {
  for (let attempt = 1; attempt <= RUN_NUMBER_ATTEMPTS; attempt++) {
    try {
      const latest = await prisma.pipelineRun.findFirst({
        select: { runNumber: true },
        orderBy: { runNumber: 'desc' },
        where: { pipelineId: data.pipelineId }
      });

      return await prisma.pipelineRun.create({
        select: { id: true },
        data: { ...data, trigger: TRIGGER_MAP[data.trigger], runNumber: (latest?.runNumber ?? 0) + 1 },
      });
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError 
          && error.code === 'P2002'
          && attempt < RUN_NUMBER_ATTEMPTS ) continue;
        throw error;
    }
  }

  // TypeScript cannot prove the loop runs at all, so the function needs an exit here.
  throw new Error(`could not allocate a run number for pipeline ${data.pipelineId}`);
}

