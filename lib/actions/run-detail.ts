"use server"

import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma, type RunStatus as PrismaRunStatus } from '@/generated/prisma/client';
import { auth } from '@/auth';
import { enqueuePipelineRun } from '@/lib/queue/runs';

const RETRYABLE: Record<PrismaRunStatus, boolean> = {
  QUEUED: false, RUNNING: false, SUCCEEDED: true, FAILED: true, CANCELLED: true
}

export async function retryRun(id: string): Promise<FormState & { runId?: string }> {
  const session = await auth();
  const triggeredById = session?.user?.id ?? null;

  if (!triggeredById) return {
    status: 'error',
    message: 'Sign in to run a pipeline.'
  }

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

    const retry = await prisma.pipelineRun.create({
      select: { id: true },
      data: {
        pipelineId: run.pipelineId,
        definitionId: run.definitionId,
        environmentId: run.environmentId,
        trigger: 'MANUAL',
        triggeredById
      }
    });

    await enqueuePipelineRun(retry.id);

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

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to cancel a run.'
  }

  try {
    const { count } = await prisma.pipelineRun.updateMany({
      where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });

    if (count === 0) return {
      status: 'error',
      message: 'This run has already finished.'
    }

    /*
     * Every stage that will now never run. Deliberately not the RUNNING one: the runner
     * owns that row and writes it CANCELLED once its kill lands.
     *
     * AWAITING_APPROVAL has to be here — getApprovals filters on stage status alone, so
     * leaving it would keep a live approval card for a run nothing will advance.
     */
    await prisma.stageResult.updateMany({
      where: { runId: id, status: { in: ['PENDING', 'QUEUED', 'AWAITING_APPROVAL'] } },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });

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
