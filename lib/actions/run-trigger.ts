import prisma from '@/lib/prisma';
import { enqueuePipelineRun } from '@/lib/queue/runs';

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
