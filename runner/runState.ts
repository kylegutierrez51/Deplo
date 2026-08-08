import { buildMaps } from "@/lib/pipeline/adjacency";
import type { ConfigJson, GraphJson } from "@/lib/types";

type RunGraphState = {
  adjacency: Map<string, string[]>;
  inDegree: Map<string, number>;
  config: ConfigJson;
  totalStages: number;
  completedStages: number;
};

const runGraphs = new Map<string, RunGraphState>();

/** Registers a run's dependency graph and returns the stages with no dependencies, ready to enqueue immediately. */
export function startRun(runId: string, graphJson: GraphJson, config: ConfigJson): string[] {
  const { adjacency, inDegree } = buildMaps(graphJson.edges, graphJson.nodes);
  runGraphs.set(runId, {
    adjacency,
    inDegree,
    config,
    totalStages: graphJson.nodes.length,
    completedStages: 0,
  });

  return [...inDegree.entries()].filter(([_, degree]) => degree === 0).map(([stageId]) => stageId);
}

/**
 * Decrements in-degree for the completed stage's dependents against this run's own maps,
 * so concurrent runs never touch each other's state. Returns the stages that just became
 * ready plus this run's config, or null if runId isn't tracked. Clears the run's state once
 * every stage has completed.
 */
export function completeStage(runId: string, stageId: string): { ready: string[], config: ConfigJson } | null {
  const state = runGraphs.get(runId);
  if (!state) return null;

  state.completedStages += 1;

  const ready: string[] = [];

  for (const stage of state.adjacency.get(stageId) ?? []) {
    const remaining = (state.inDegree.get(stage) ?? 0) - 1;
    state.inDegree.set(stage, remaining);

    if (remaining <= 0) {
      ready.push(stage);
    }
  }

  if (state.completedStages >= state.totalStages) {
    runGraphs.delete(runId);
  }

  return {
    ready, 
    config: state.config
  }
}



export function failRun(runId: string): boolean {
  return runGraphs.delete(runId);
}