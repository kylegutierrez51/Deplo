import { graphJson } from "./sample";
import type { GraphJson } from "./types";

function buildMaps(graphJson: GraphJson) {
  const dependencyMap = new Map<string, number>();
  const adjacencyMap = new Map<string, string[]>();

  for (const edge of graphJson.edges) {
    if (dependencyMap.get(edge.source) === undefined) {
      dependencyMap.set(edge.source, 0);
    }
    dependencyMap.set(edge.target, (dependencyMap.get(edge.target) ?? 0) + 1);
  }

  for (const edge of graphJson.edges) {
    adjacencyMap.set(edge.source, [ ...(adjacencyMap.get(edge.source) ?? []), edge.target ])
  }

  return [dependencyMap, adjacencyMap];
}

export const [dependencyMap, adjacencyMap] = buildMaps(graphJson);

console.log(dependencyMap);
console.log(adjacencyMap);






export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}