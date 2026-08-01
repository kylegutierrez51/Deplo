import { type Edge } from "@xyflow/react";
import { CustomNode } from "@/lib/types";

export function buildMaps(edges: Edge[], nodes: CustomNode[]) {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // catches cases where there's a single node with no edges to or from it
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);

    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }

  return { inDegree, adjacency };
}