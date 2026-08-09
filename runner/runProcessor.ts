import { loadRunContext, materializeStages, startRunIfQueued, claimStageForApproval, claimStageForQueue, finalizeRun, cancelPendingStages } from './db';
import { runOutcome, readyStages } from './scheduler';
import { enqueueStageJob } from './stageQueue';



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
      await cancelPendingStages(runId);
    }
    return;
  }

  const readyNodes = readyStages(context.graph, context.outcomes);

  for (const nodeId of readyNodes) {
    const node = context.graph.nodes.find(node => node.id === nodeId);
    if (!node) continue;

    if (node.data.type !== 'approval') {
      const queuedStage = await claimStageForQueue(runId, nodeId, 1);
      if (queuedStage) await enqueueStageJob({ runId, stageId: nodeId, attempt: 1 });
    } else {
      await claimStageForApproval(runId, nodeId, 1);
    }
  }
}
 