import type { Edge } from '@xyflow/react';
import type { ConfigJson, CustomNode, GraphJson, StageConfig, StageType } from '@/lib/types';

const NODE_TYPE = 'standardStage';
const EDGE_TYPE = 'customEdge';
const EDGE_MARKER = 'marker';

const STAGE_TYPES: StageType[] = ['custom', 'deploy', 'approval'];

// if this returns true, then the type of the value is a Record<string, unknown>
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// serialization
export function toDefinition(nodes: CustomNode[], edges: Edge[]): { graphJson: GraphJson, configJson: ConfigJson } {
  const graphJson: GraphJson = {
    nodes: nodes.map(node => ({
      id: node.id,
      position: { x: node.position.x, y: node.position.y },
      data: {
        type: node.data.type ?? 'custom',
        ...(node.data.name !== undefined && { name: node.data.name }),
        ...(node.data.label !== undefined && { label: node.data.label }),
      },
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };

  const configJson: ConfigJson = Object.fromEntries(
    nodes.map(node => [node.id, {
      command: node.data.command ?? null,
      timeout: node.data.timeout ?? null,
      retries: node.data.retries ?? null,
      env_vars: node.data.env_vars ?? [],
      secrets: node.data.secrets ?? {},
    } satisfies StageConfig])
  );

  return { graphJson, configJson };
}

// deserialization
export function fromDefinition(graphJson: unknown, configJson: unknown): GraphJson {
  const graph = isRecord(graphJson) ? graphJson : {};
  const config = isRecord(configJson) ? configJson : {};

  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const nodes: CustomNode[] = rawNodes
    .filter(isRecord)
    .filter(node => typeof node.id === 'string')
    .map(node => {
      const id = node.id as string;
      const data = isRecord(node.data) ? node.data : {};
      const stageConfig = isRecord(config[id]) ? config[id] : {};
      const position = isRecord(node.position) ? node.position : {};

      return {
        id,
        type: NODE_TYPE,
        position: {
          x: typeof position.x === 'number' ? position.x : 0,
          y: typeof position.y === 'number' ? position.y : 0,
        },
        data: {
          type: STAGE_TYPES.find(type => type === data.type) ?? 'custom',
          ...(typeof data.name === 'string' && { name: data.name }),
          ...(typeof data.label === 'string' && { label: data.label }),
          ...(typeof stageConfig.command === 'string' && { command: stageConfig.command }),
          ...(typeof stageConfig.timeout === 'number' && { timeout: stageConfig.timeout }),
          ...(typeof stageConfig.retries === 'number' && { retries: stageConfig.retries }),
          ...(Array.isArray(stageConfig.env_vars) && { env_vars: stageConfig.env_vars as Record<string, string>[] }),
          ...(isRecord(stageConfig.secrets) && { secrets: stageConfig.secrets as Record<string, string[]> }),
        },
      };
    });

  const edges: Edge[] = rawEdges
    .filter(isRecord)
    .filter(edge => typeof edge.id === 'string' && typeof edge.source === 'string' && typeof edge.target === 'string')
    .map(edge => ({
      id: edge.id as string,
      source: edge.source as string,
      target: edge.target as string,
      type: EDGE_TYPE,
      markerEnd: EDGE_MARKER,
    }));

  return { nodes, edges };
}
