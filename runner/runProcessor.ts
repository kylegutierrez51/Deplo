import { loadRunContext, materializeStages, startRunIfQueued, claimStageForApproval, claimStageForQueue, finalizeRun, cancelPendingAwaitingQueuedStages } from './db';
import { runOutcome, readyStages } from './scheduler';
import { enqueueStageJob } from './stageQueue';

/*
 * Applied to attempt 2 and beyond. Long enough that a transient cause — a briefly locked
 * file, a registry hiccup — has a moment to clear, short enough that a ten-retry stage does
 * not hold its run open for minutes on end.
 */
const RETRY_DELAY_MS = 5_000;



export async function processRun(runId: string): Promise<void> {
  const context = await loadRunContext(runId);
  if (!context) return;
  if (context.runStatus === 'QUEUED') {
    await materializeStages(runId, context.graph);
    // The boolean is deliberately ignored: 'false' means a redelivered job or another process already started the run, which is not a reason to stop advancing it.
    await startRunIfQueued(runId);
  }

  await advanceRun(runId);
}

export async function advanceRun(runId: string): Promise<void> {
  const context = await loadRunContext(runId);
  if (!context || context.runStatus !== 'RUNNING') return;

  const outcome = runOutcome(context.graph, context.outcomes);

  if (outcome) {
    const finalized = await finalizeRun(runId, outcome);
    if (finalized && outcome === 'FAILED') {
      await cancelPendingAwaitingQueuedStages(runId);
    }
    return;
  }

  const readyNodes = readyStages(context.graph, context.outcomes);

  for (const nodeId of readyNodes) {
    const node = context.graph.nodes.find(node => node.id === nodeId);
    if (!node) continue;

    const attempt = context.attempts.get(nodeId) ?? 1;

    if (node.data.type !== 'approval') {
      const queuedStage = await claimStageForQueue(runId, nodeId, attempt);
      if (queuedStage) {
        await enqueueStageJob({ runId, stageId: nodeId, attempt }, attempt > 1 ? RETRY_DELAY_MS : 0);
      }
    } else {
      await claimStageForApproval(runId, nodeId, attempt);
    }
  }
}
 