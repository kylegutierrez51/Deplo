import type { GraphJson } from "./types";

export function buildMaps(graphJson: GraphJson) {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const edge of graphJson.edges) {
    if (inDegree.get(edge.source) === undefined) {
      inDegree.set(edge.source, 0);
    }
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  for (const edge of graphJson.edges) {
    adjacency.set(edge.source, [ ...(adjacency.get(edge.source) ?? []), edge.target ])
  }

  return { inDegree, adjacency };
}