import type { Edge } from '@xyflow/react';
import type { ConfigJson, CustomNode, GraphJson } from '@/lib/types';
import { buildMaps } from '@/lib/pipeline/adjacency';
import { matchReservedLabel } from '@/lib/utils/string';

// Everything a run is checked against before a PipelineRun row is created.

// Node ids are uuids and mean nothing to the user, so name the stage the way the editor does.
function stageLabel(node: CustomNode): string {
  return node.data.name?.trim() || node.data.label?.trim() || node.id;
}

function listStages(nodes: CustomNode[]): string {
  return nodes.map(node => `"${stageLabel(node)}"`).join(', ');
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

// target -> sources. buildMaps covers the forward direction; every "what runs before this stage" question needs this one.
function buildReverseAdjacency(edges: Edge[]): Map<string, string[]> {
  const reverse = new Map<string, string[]>();

  for (const edge of edges) {
    reverse.set(edge.target, [...(reverse.get(edge.target) ?? []), edge.source]);
  }

  return reverse;
}

/** Edges naming a stage the graph no longer holds. */
export function findDanglingEdges(edges: Edge[], nodes: CustomNode[]): Edge[] {
  const ids = new Set(nodes.map(node => node.id));
  return edges.filter(edge => !ids.has(edge.source) || !ids.has(edge.target));
}

/**
 * Kahn's algorithm: drain every stage whose dependencies are satisfied, and
 * whatever will not drain is held up by a cycle. Returns that cycle as a
 * readable path (`build → deploy → build`), or null when the graph is a DAG.
 *
 * Assumes every edge references a real node — run findDanglingEdges first, or a
 * phantom target inflates its own in-degree and reads as a cycle that isn't there.
 */
export function detectCycle(edges: Edge[], nodes: CustomNode[]): string[] | null {
  const { inDegree, adjacency } = buildMaps(edges, nodes);

  const ready = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const drained = new Set<string>();

  while (ready.length) {
    const node = ready.pop()!;
    drained.add(node);

    for (const targetNode of adjacency.get(node) ?? []) {
      const remaining = (inDegree.get(targetNode) ?? 0) - 1;
      inDegree.set(targetNode, remaining);

      if (remaining === 0) ready.push(targetNode);
    }
  }

  if (drained.size === inDegree.size) return null;

  const stuck = new Set([...inDegree.keys()].filter(id => !drained.has(id)));
  return describeCycle(stuck, edges, nodes);
}

/*
 - Walks backwards from a stuck stage until it revisits one — that repeat is the cycle.
 - Backwards is what makes this terminate. A stage survives Kahn's only because an
 - incoming edge was never decremented, so it is guaranteed a stuck predecessor;
 - walking forwards can dead-end on a stage that merely hangs off a cycle
 - (A→B→C→A plus A→D leaves D stuck with nowhere to go).
*/
function describeCycle(stuck: Set<string>, edges: Edge[], nodes: CustomNode[]): string[] {
  const reverse = buildReverseAdjacency(edges);
  const nodesById = new Map(nodes.map(node => [node.id, node]));

  const visitedAt = new Map<string, number>();
  const walk: string[] = [];

  let current = [...stuck][0];

  while (!visitedAt.has(current)) {
    visitedAt.set(current, walk.length);
    walk.push(current);
    current = (reverse.get(current) ?? []).find(id => stuck.has(id))!;
  }

  // Reversed because the walk ran against the edges; the entry stage repeats at
  // the end so the message closes the loop it describes.
  const cycle = walk.slice(visitedAt.get(current)!).reverse();

  return [...cycle, cycle[0]].map(id => {
    const node = nodesById.get(id);
    return node ? stageLabel(node) : id;
  });
}

/*
==============================================================================================
 * Deploy stages with no Approval stage anywhere upstream.
 *
 * Any ancestor counts, not only the immediate parent. A stage becomes eligible only
 * once every parent has succeeded (scheduler.readyStages), and an approval stage is
 * never enqueued — runProcessor.advanceRun writes it AWAITING_APPROVAL and waits — so
 * an ungranted approval stalls everything downstream of it transitively. One approval
 * ancestor is therefore enough to guarantee the gate the environment promises.
 *
 * A deploy stage with no parents at all fails, which is the point — nothing gates it.
==============================================================================================
*/

export function findUngatedDeployStages(edges: Edge[], nodes: CustomNode[]): CustomNode[] {
  const reverse = buildReverseAdjacency(edges);
  const typeById = new Map(nodes.map(node => [node.id, node.data.type]));

  const hasApprovalAncestor = (deployId: string): boolean => {
    // copied before use — pushing onto the map's own array would corrupt it
    const queue = [...(reverse.get(deployId) ?? [])];
    const seen = new Set(queue);

    while (queue.length) {
      const id = queue.pop()!;
      if (typeById.get(id) === 'approval') return true;

      for (const parent of reverse.get(id) ?? []) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        queue.push(parent);
      }
    }

    return false;
  };

  return nodes.filter(node => node.data.type === 'deploy' && !hasApprovalAncestor(node.id));
}

export function validatePipelineGraph(graphJson: GraphJson, configJson: ConfigJson, requireApproval: boolean): string[] {
  const { nodes, edges } = graphJson;
  const errors: string[] = [];

  const dangling = findDanglingEdges(edges, nodes);

  // Every check below keys off node ids, so a phantom endpoint makes them report
  // nonsense — a dangling target even reads as a cycle. Nothing else is trustworthy.
  if (dangling.length) return [
    `${dangling.length} ${plural(dangling.length, 'connection')} ${plural(dangling.length, 'points', 'point')} to a stage that no longer exists. Delete and redraw ${plural(dangling.length, 'it', 'them')}.`
  ];

  const unnamed = nodes.filter(node => !node.data.name?.trim());

  if (unnamed.length) errors.push(
    `${unnamed.length} ${plural(unnamed.length, 'stage')} ${plural(unnamed.length, 'has', 'have')} no name.`
  );


  const reserved = nodes.filter(node => node.data.type === 'custom' && matchReservedLabel(node.data.label));

  if (reserved.length) errors.push(
    `${plural(reserved.length, 'A Custom stage cannot', 'Custom stages cannot')} be labeled "Approval" or "Deploy": ${listStages(reserved)}.`
  );


  const missingCommand = nodes.filter(node => node.data.type !== 'approval' && !configJson[node.id]?.command?.trim());

  if (missingCommand.length) errors.push(
    `${missingCommand.length} ${plural(missingCommand.length, 'stage')} ${plural(missingCommand.length, 'is', 'are')} missing a command: ${listStages(missingCommand)}.`
  );

  const cycle = detectCycle(edges, nodes);

  if (cycle) {
    errors.push(`Cycle detected: ${cycle.join(' → ')}. Stages must flow in one direction.`);
    // An ancestor walk over a cyclic graph has nothing useful to report.
    return errors;
  }

  if (requireApproval) {
    const ungated = findUngatedDeployStages(edges, nodes);

    if (ungated.length) errors.push(
      `The selected environment requires approval before deploying, but ${plural(ungated.length, 'this Deploy stage has', 'these Deploy stages have')} no Approval stage upstream: ${listStages(ungated)}.`
    );
  }

  return errors;
}
