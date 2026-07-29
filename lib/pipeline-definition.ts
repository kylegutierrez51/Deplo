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

/**
 * Sorts each environment's secret ids.
 *
 * handleSecretToggle appends on check, so the ids arrive in click order —
 * checking the same two secrets in the other order yields a different array for
 * the same set. Nothing downstream reads their order (the editor and the runner
 * both only test membership), so it is incidental, and normalizing it here stops
 * a re-check from reading as an edit and minting a version.
 *
 * env_vars is deliberately left alone: the user arranges those rows themselves,
 * so their order is real. Same for graphJson's nodes, which drive display order
 * on the Run Detail page.
 */
function sortSecretIds(secrets: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    // copied before sorting — sort() mutates, and these arrays are React state
    Object.entries(secrets).map(([environmentId, ids]) => [environmentId, [...ids].sort()])
  );
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
      secrets: sortSecretIds(node.data.secrets ?? {}),
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

// comparison
type DefinitionContent = { graphJson: unknown, configJson: unknown };

/**
 * Stringifies with object keys sorted at every depth.
 *
 * Postgres jsonb does not preserve key insertion order — it normalizes keys by
 * length, then bytewise. So a definition just built by toDefinition and the same
 * document read back from the database almost never match under a plain
 * JSON.stringify, even when they hold identical data. Sorting both sides first
 * is what makes them comparable.
 */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  // JSON.stringify returns undefined (not a string) for undefined/function values
  return JSON.stringify(value) ?? 'null';
}

export function definitionsEqual(a: DefinitionContent, b: DefinitionContent): boolean {
  return canonicalize(a.graphJson) === canonicalize(b.graphJson)
    && canonicalize(a.configJson) === canonicalize(b.configJson);
}



//   nodes: [                                             // ← inserted 1st
//     { id: 'n1', position: { x: 10, y: 20 },  data: { type: 'custom',   name: 'lint' } },
//     { id: 'n2', position: { x: 240, y: 20 }, data: { type: 'approval', name: 'gate' } },
//   ],
//   edges: [ { id: 'e1', source: 'n1', target: 'n2' } ], // ← inserted 2nd
// }

// configJson = {
//   n1: { command: 'npm run lint', timeout: 30, retries: null, env_vars: [{ CI: 'true' }], secrets: { env_prod: ['sec_9', 'sec_2'] } },
//   n2: { command: null, timeout: null, retries: null, env_vars: [], secrets: {} },
// }