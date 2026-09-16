"use server"

import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma, type RunStatus as PrismaRunStatus } from '@/generated/prisma/client';
import { AuditAction, ResourceType } from '@/generated/prisma';
import { auth } from '@/auth';
import { createPipelineRun, enqueueOrDiscardRun } from '@/lib/actions/run-trigger';
import { isQueueReachable } from '../queue/health';
import { addAudit } from './audits';

const RETRYABLE: Record<PrismaRunStatus, boolean> = {
  QUEUED: false, RUNNING: false, SUCCEEDED: true, FAILED: true, CANCELLED: true
}

export async function retryRun(id: string): Promise<FormState & { runId?: string }> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to run a pipeline.'
  }

  const userId = user.id;

  try {
    const run = await prisma.pipelineRun.findUnique({
      where: { id },
      select: { status: true, pipelineId: true, definitionId: true, environmentId: true }
    });

    if (!run) {
      return {
        status: 'error',
        message: 'This run no longer exists. It cannot be re-run.'
      }
    }

    if (!RETRYABLE[run.status]) return {
      status: 'error',
      message: 'This run has not finished yet.'
    }

    // When redis is down, this guard lets user waits <= 500ms instead of 5000ms.
    // Since it caches, each subsequent trigger in the next 5 seconds makes user wait less than 500ms
    if (!await isQueueReachable()) return {
      status: 'error',
      message: 'Could not reach the job queue, so the run was not started. Please try again.'
    }

    const retry = await createPipelineRun({
      pipelineId: run.pipelineId,
      environmentId: run.environmentId,
      definitionId: run.definitionId,
      trigger: 'manual',
      user: { id: userId, name: user.name ?? null }
    });


    // Takes the row back rather than leaving it stranded at QUEUED — see run-trigger.ts.
    if (!await enqueueOrDiscardRun(retry.id)) return {
      status: 'error',
      message: 'Could not reach the job queue, so the run was not started. Please try again.'
    }

    revalidatePath('/runs');
    revalidatePath(`/runs/${id}`);

    return {
      status: 'success',
      message: `Run retried!`,
      runId: retry.id
    };

  } catch (error: unknown) {
    // P2003: the definition or environment the new run points at was deleted between the read above and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2003' || error.code === 'P2025')) {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This pipeline or environment no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: `Error retrying run. Please try again.`,
    };
  }
}


/*
 * Cancelling writes the intent and lets the runner catch up. Marking the run terminal is
 * itself the stop switch: advanceRun early-returns on anything that is not RUNNING, so no
 * further stage is claimed or enqueued from the moment this commits.
 */
export async function cancelRun(id: string): Promise<FormState> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to cancel a run.'
  }

  const userId = user.id;

  try {
    const cancelled = await prisma.$transaction(async (tx) => {
      const { count } = await tx.pipelineRun.updateMany({
        where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      });

      if (count === 0) return false;

      await tx.stageResult.updateMany({
        where: { runId: id, status: { in: ['PENDING', 'QUEUED', 'AWAITING_APPROVAL'] } },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      });

      const run = await tx.pipelineRun.findUniqueOrThrow({
        where: { id },
        select: { runNumber: true, pipeline: { select: { name: true } } }
      });

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.RUN_CANCELLED,
        resourceType: ResourceType.PIPELINE_RUN,
        resourceId: id,
        resourceLabel: run.pipeline.name + ' #' + run.runNumber,
        resourceMeta: { kind: 'run', pipelineName: run.pipeline.name, runNumber: run.runNumber }
      }, tx);

      return true;
    });

    if (!cancelled) return {
      status: 'error',
      message: 'This run has already finished.'
    }

    revalidatePath('/runs');
    revalidatePath(`/runs/${id}`);
    revalidatePath('/approvals');

    return {
      status: 'success',
      message: `Run cancelled!`
    };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(`${error.code}: ${error.message}`);
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: `Error cancelling run. Please try again.`,
    };
  }
}
