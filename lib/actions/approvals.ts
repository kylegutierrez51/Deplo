"use server"

import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from '@/generated/prisma/client';
import { auth } from '@/auth';
import { enqueuePipelineRun } from '@/lib/queue/runs';

export async function approveOrRejectStage(id: string, runId: string, stageId: string, approved: boolean): Promise<FormState> {
  const session = await auth();
  const approvedById = session?.user?.id ?? null;

  if (!approvedById) return {
    status: 'error',
    message: 'Sign in to approve a pipeline.'
  }

  try {
    // The same compare-and-swap the runner uses: the where clause names the status the row
    // is expected to be in, and count is an ownership signal rather than an error code.
    const { count } = await prisma.stageResult.updateMany({
      where: { id, runId, stageId, stageType: 'APPROVAL', status: 'AWAITING_APPROVAL' },
      data: { status: approved ? 'APPROVED' : 'UNAPPROVED', approvedById, approvedAt: new Date(), finishedAt: new Date() },
    });

    if (count === 0) {
      const stage = await prisma.stageResult.findUnique({
        where: { id },
        select: { status: true, run: { select: { status: true } } }
      });

      revalidatePath('/approvals');

      if (stage?.status === 'CANCELLED') return {
        status: 'error',
        message: stage.run.status === 'CANCELLED'
          ? 'This run was cancelled, so the approval is no longer needed.'
          : 'This run already failed at another stage, so the approval is no longer needed.'
      };

      return {
        status: 'error',
        message: 'This approval has already been decided.'
      }
    }


    try {
      await enqueuePipelineRun(runId, `approval-${stageId}`);
    } catch (error: unknown) {
      console.error(
        `the decision on stage ${stageId} of run ${runId} was committed but could not be enqueued:`,
        error instanceof Error ? error.message : error,
      );
    }

    revalidatePath('/approvals');
    revalidatePath('/runs');
    revalidatePath(`/runs/${runId}`);

    return {
      status: 'success',
      message: `Stage ${approved ? 'approved' : 'rejected'}`
    };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(`${error.code}: ${error.message}`);
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: `Error ${approved ? 'approving' : 'rejecting'} stage. Please try again.`,
    };
  }
}