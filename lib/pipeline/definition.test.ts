import type { Edge } from '@xyflow/react';
import type { CustomNode } from '@/lib/types';
import { toDefinition, fromDefinition, canonicalize, definitionsEqual } from '@/lib/pipeline/definition';

/*
 * This module decides whether a save mints a new pipeline version, so a false
 * "changed" verdict inflates the version history on every no-op save and a false
 * "unchanged" verdict silently discards a real edit. The canonicalize cases below
 * are the ones that property rests on.
 */

const node = (id: string, data: Partial<CustomNode['data']> = {}): CustomNode => ({
  id,
  position: { x: 10, y: 20 },
  data: { type: 'custom', name: id, ...data },
});

describe('toDefinition', () => {
  it('splits presentation into graphJson and execution config into configJson', () => {
    const nodes = [node('a', { command: 'npm test', timeout: 60, retries: 2 })];
    const { graphJson, configJson } = toDefinition(nodes, []);

    expect(graphJson.nodes[0]).toEqual({
      id: 'a',
      position: { x: 10, y: 20 },
      data: { type: 'custom', name: 'a' },
    });
    expect(configJson.a).toEqual({
      command: 'npm test', timeout: 60, retries: 2, env_vars: [], secrets: {},
    });
  });

  it('defaults absent execution config to null rather than dropping the keys', () => {
    const { configJson } = toDefinition([node('a')], []);

    expect(configJson.a).toEqual({
      command: null, timeout: null, retries: null, env_vars: [], secrets: {},
    });
  });

  it('defaults a node with no type to custom', () => {
    const untyped = { id: 'a', position: { x: 0, y: 0 }, data: {} } as unknown as CustomNode;
    const { graphJson } = toDefinition([untyped], []);

    expect(graphJson.nodes[0].data.type).toBe('custom');
  });

  // The spread is conditional on !== undefined, so an absent name must not
  // appear as an explicit `name: undefined` key — that would canonicalize to
  // "null" and read as a change against a definition that never had the key.
  it('omits name and label entirely when they are undefined', () => {
    const bare = { id: 'a', position: { x: 0, y: 0 }, data: { type: 'custom' as const } };
    const { graphJson } = toDefinition([bare], []);

    expect(Object.keys(graphJson.nodes[0].data)).toEqual(['type']);
  });

  it('keeps only id, source and target from an edge', () => {
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b', type: 'customEdge', markerEnd: 'marker', animated: true },
    ];
    const { graphJson } = toDefinition([], edges);

    expect(graphJson.edges[0]).toEqual({ id: 'e1', source: 'a', target: 'b' });
  });

  it('preserves node order, which drives Run Detail display order', () => {
    const { graphJson } = toDefinition([node('c'), node('a'), node('b')], []);

    expect(graphJson.nodes.map(n => n.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('toDefinition secret ordering', () => {
  // handleSecretToggle appends on check, so ids arrive in click order. Nothing
  // downstream reads that order, so normalizing it stops a re-check from reading
  // as an edit and minting a version.
  it('sorts each environmential secret list', () => {
    const { configJson } = toDefinition([node('a', { secrets: { env1: ['s3', 's1', 's2'] } })], []);

    expect(configJson.a.secrets).toEqual({ env1: ['s1', 's2', 's3'] });
  });

  it('makes two different click orders of the same set compare equal', () => {
    const first = toDefinition([node('a', { secrets: { env1: ['s1', 's2'] } })], []);
    const second = toDefinition([node('a', { secrets: { env1: ['s2', 's1'] } })], []);

    expect(definitionsEqual(first, second)).toBe(true);
  });

  it('does not mutate the caller array, which is React state', () => {
    const secrets = { env1: ['s3', 's1'] };
    toDefinition([node('a', { secrets })], []);

    expect(secrets.env1).toEqual(['s3', 's1']);
  });

  // env_vars order is the user's own arrangement, so it is real data, not
  // incidental like secret click order.
  it('leaves env_vars order alone', () => {
    const env_vars = [{ key: 'B', value: '2' }, { key: 'A', value: '1' }];
    const { configJson } = toDefinition([node('a', { env_vars })], []);

    expect(configJson.a.env_vars).toEqual(env_vars);
  });
});

describe('fromDefinition', () => {
  it('re-merges graph and config into the single shape ReactFlow wants', () => {
    const graphJson = { nodes: [{ id: 'a', position: { x: 1, y: 2 }, data: { type: 'deploy', name: 'ship' } }], edges: [] };
    const configJson = { a: { command: 'deploy.sh', timeout: 30, retries: 1, env_vars: [], secrets: {} } };

    const { nodes } = fromDefinition(graphJson, configJson);

    expect(nodes[0]).toEqual({
      id: 'a',
      type: 'standardStage',
      position: { x: 1, y: 2 },
      data: {
        type: 'deploy', name: 'ship', command: 'deploy.sh', timeout: 30, retries: 1,
        env_vars: [], secrets: {},
      },
    });
  });

  it('re-attaches the edge type and marker the editor renders with', () => {
    const graphJson = { nodes: [], edges: [{ id: 'e1', source: 'a', target: 'b' }] };

    const { edges } = fromDefinition(graphJson, {});

    expect(edges[0]).toEqual({
      id: 'e1', source: 'a', target: 'b', type: 'customEdge', markerEnd: 'marker',
    });
  });

  it('round-trips a definition through toDefinition without losing anything', () => {
    const nodes = [
      node('a', { command: 'npm ci', timeout: 60, retries: 3, env_vars: [{ key: 'K', value: 'V' }], secrets: { e1: ['s1'] } }),
      node('b', { type: 'approval', label: 'Gate' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    const { graphJson, configJson } = toDefinition(nodes, edges);
    const restored = fromDefinition(graphJson, configJson);
    const reserialized = toDefinition(restored.nodes, restored.edges);

    expect(definitionsEqual({ graphJson, configJson }, reserialized)).toBe(true);
  });
});

describe('fromDefinition defensive handling', () => {
  // The arguments are `unknown` because they come straight out of a jsonb column
  // that predates the current shape, so every one of these is reachable.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nonsense'],
    ['a number', 42],
    ['an array', [1, 2, 3]],
  ])('yields an empty graph for %s', (_label, input) => {
    expect(fromDefinition(input, {})).toEqual({ nodes: [], edges: [] });
  });

  it('yields empty collections when nodes and edges are not arrays', () => {
    expect(fromDefinition({ nodes: 'no', edges: 5 }, {})).toEqual({ nodes: [], edges: [] });
  });

  it('drops a node with no string id', () => {
    const graphJson = { nodes: [{ id: 7, data: {} }, { data: {} }, { id: 'ok', data: {} }], edges: [] };

    expect(fromDefinition(graphJson, {}).nodes.map(n => n.id)).toEqual(['ok']);
  });

  it('falls back to custom for a stage type outside the whitelist', () => {
    const graphJson = { nodes: [{ id: 'a', data: { type: 'rollback' } }], edges: [] };

    expect(fromDefinition(graphJson, {}).nodes[0].data.type).toBe('custom');
  });

  it('defaults a non-numeric position to the origin', () => {
    const graphJson = { nodes: [{ id: 'a', position: { x: 'left', y: null }, data: {} }], edges: [] };

    expect(fromDefinition(graphJson, {}).nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('drops an edge missing any of id, source or target', () => {
    const graphJson = {
      nodes: [],
      edges: [
        { id: 'e1', source: 'a' },
        { source: 'a', target: 'b' },
        { id: 'e3', source: 'a', target: 'b' },
      ],
    };

    expect(fromDefinition(graphJson, {}).edges.map(e => e.id)).toEqual(['e3']);
  });

  it('omits config fields whose stored type is wrong rather than passing them through', () => {
    const graphJson = { nodes: [{ id: 'a', data: {} }], edges: [] };
    const configJson = { a: { command: 42, timeout: '30', retries: null } };

    expect(fromDefinition(graphJson, configJson).nodes[0].data).toEqual({ type: 'custom' });
  });
});

describe('canonicalize', () => {
  // Postgres jsonb normalizes key order by length then bytewise, so a fresh
  // definition and the same document read back almost never match under a plain
  // JSON.stringify. Sorting both sides is what makes them comparable.
  it('is insensitive to key order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it('sorts keys at every depth, not just the top level', () => {
    const deep = { outer: { z: { b: 1, a: 2 }, y: 3 } };
    const shuffled = { outer: { y: 3, z: { a: 2, b: 1 } } };

    expect(canonicalize(deep)).toBe(canonicalize(shuffled));
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  // JSON.stringify returns the value `undefined`, not a string, for these — the
  // ?? 'null' fallback is what keeps them from corrupting the output.
  it.each([
    ['undefined', undefined],
    ['a function', () => { }],
  ])('renders %s as null', (_label, input) => {
    expect(canonicalize(input)).toBe('null');
  });

  it('distinguishes a missing key from a key holding null', () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 1, b: null }));
  });

  it('does not confuse the number 1 with the string "1"', () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: '1' }));
  });
});

describe('definitionsEqual', () => {
  it('is true for the same content with keys in a different order', () => {
    const a = { graphJson: { nodes: [], edges: [] }, configJson: { x: { command: 'a', timeout: null } } };
    const b = { graphJson: { edges: [], nodes: [] }, configJson: { x: { timeout: null, command: 'a' } } };

    expect(definitionsEqual(a, b)).toBe(true);
  });

  it('is false when only the config differs', () => {
    const graphJson = { nodes: [], edges: [] };

    expect(definitionsEqual(
      { graphJson, configJson: { x: { command: 'a' } } },
      { graphJson, configJson: { x: { command: 'b' } } },
    )).toBe(false);
  });

  it('is false when only the graph differs', () => {
    const configJson = {};

    expect(definitionsEqual(
      { graphJson: { nodes: [{ id: 'a' }], edges: [] }, configJson },
      { graphJson: { nodes: [{ id: 'b' }], edges: [] }, configJson },
    )).toBe(false);
  });

  // A moved node is a real edit worth a version — position lives in graphJson
  // precisely so the editor's layout survives a reload.
  it('treats a moved node as a change', () => {
    const configJson = {};

    expect(definitionsEqual(
      { graphJson: { nodes: [{ id: 'a', position: { x: 0, y: 0 } }], edges: [] }, configJson },
      { graphJson: { nodes: [{ id: 'a', position: { x: 5, y: 0 } }], edges: [] }, configJson },
    )).toBe(false);
  });
});
