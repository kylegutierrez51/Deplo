import type { Edge } from '@xyflow/react';
import type { ConfigJson, CustomNode, StageConfig, StageType } from '@/lib/types';

/*
 * Stages are written as "id" or "id:type" — `a` is a custom stage, `d:deploy` a
 * deploy one. Edges are written "source>target". Both keep each case readable as
 * the graph it describes.
 *
 * Lifted verbatim out of lib/pipeline/validation.test.ts when the suite moved to
 * Jest, so the graph tests in lib/pipeline and runner all speak one notation.
 */
export function stage(spec: string): CustomNode {
  const [id, type = 'custom'] = spec.split(':');
  return { id, position: { x: 0, y: 0 }, data: { type: type as StageType, name: id } };
}

export function graph(stageSpecs: string, edgeSpecs = ''): { nodes: CustomNode[], edges: Edge[] } {
  const nodes = stageSpecs.split(' ').filter(Boolean).map(stage);
  const edges = edgeSpecs.split(' ').filter(Boolean).map((spec, index) => {
    const [source, target] = spec.split('>');
    return { id: `e${index}`, source, target };
  });
  return { nodes, edges };
}

/** Every stage gets a command, so a case only exercises the rule it is about. */
export function configFor(nodes: CustomNode[], overrides: Record<string, Partial<StageConfig>> = {}): ConfigJson {
  return Object.fromEntries(nodes.map(node => [node.id, {
    command: 'npm run build',
    timeout: null,
    retries: null,
    env_vars: [],
    secrets: {},
    ...overrides[node.id],
  }]));
}

export const names = (nodes: CustomNode[]) => nodes.map(node => node.id).sort();
