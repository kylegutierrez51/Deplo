import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Edge } from '@xyflow/react';
import type { ConfigJson, CustomNode, StageConfig, StageType } from '@/lib/types';
import { detectCycle, findDanglingEdges, findUngatedDeployStages, validatePipelineGraph } from '@/lib/pipeline/graph';

/*
 * Stages are written as "id" or "id:type" — `a` is a custom stage, `d:deploy` a
 * deploy one. Edges are written "source>target". Both keep each case readable as
 * the graph it describes.
 */
function stage(spec: string): CustomNode {
  const [id, type = 'custom'] = spec.split(':');
  return { id, position: { x: 0, y: 0 }, data: { type: type as StageType, name: id } };
}

function graph(stageSpecs: string, edgeSpecs = ''): { nodes: CustomNode[], edges: Edge[] } {
  const nodes = stageSpecs.split(' ').filter(Boolean).map(stage);
  const edges = edgeSpecs.split(' ').filter(Boolean).map((spec, index) => {
    const [source, target] = spec.split('>');
    return { id: `e${index}`, source, target };
  });
  return { nodes, edges };
}

/** Every stage gets a command, so a case only exercises the rule it is about. */
function configFor(nodes: CustomNode[], overrides: Record<string, Partial<StageConfig>> = {}): ConfigJson {
  return Object.fromEntries(nodes.map(node => [node.id, {
    command: 'npm run build',
    timeout: null,
    retries: null,
    env_vars: [],
    secrets: {},
    ...overrides[node.id],
  }]));
}

const names = (nodes: CustomNode[]) => nodes.map(node => node.id).sort();

describe('detectCycle', () => {
  test('empty graph is acyclic', () => {
    const { nodes, edges } = graph('');
    assert.equal(detectCycle(edges, nodes), null);
  });

  test('a lone stage with no edges is acyclic', () => {
    const { nodes, edges } = graph('a');
    assert.equal(detectCycle(edges, nodes), null);
  });

  test('a chain is acyclic', () => {
    const { nodes, edges } = graph('a b c d', 'a>b b>c c>d');
    assert.equal(detectCycle(edges, nodes), null);
  });

  // A visited-set DFS reports a cycle here because d is reached twice by
  // different paths. Kahn's counts dependencies instead, so it does not.
  test('a diamond is acyclic', () => {
    const { nodes, edges } = graph('a b c d', 'a>b a>c b>d c>d');
    assert.equal(detectCycle(edges, nodes), null);
  });

  test('parallel duplicate edges are acyclic', () => {
    const { nodes, edges } = graph('a b', 'a>b a>b');
    assert.equal(detectCycle(edges, nodes), null);
  });

  test('a self-loop is a cycle', () => {
    const { nodes, edges } = graph('a', 'a>a');
    assert.deepEqual(detectCycle(edges, nodes), ['a', 'a']);
  });

  test('a two-stage cycle is caught regardless of edge order', () => {
    const forwards = graph('a b', 'a>b b>a');
    const backwards = graph('a b', 'b>a a>b');

    assert.ok(detectCycle(forwards.edges, forwards.nodes));
    assert.ok(detectCycle(backwards.edges, backwards.nodes));
  });

  // The case the previous implementation missed: it only compared an edge
  // against the reverse of itself, so nothing longer than two stages registered.
  test('a three-stage cycle is caught', () => {
    const { nodes, edges } = graph('a b c', 'a>b b>c c>a');
    const cycle = detectCycle(edges, nodes);

    assert.ok(cycle);
    assert.equal(cycle.length, 4, 'path repeats its entry stage to close the loop');
    assert.equal(cycle[0], cycle.at(-1));
    assert.deepEqual([...new Set(cycle)].sort(), ['a', 'b', 'c']);
  });

  test('a cycle is caught in a graph that also has a valid path', () => {
    const { nodes, edges } = graph('a b c d', 'a>b b>c c>b c>d');
    assert.ok(detectCycle(edges, nodes));
  });

  test('a cycle is caught when only one of two components has one', () => {
    const { nodes, edges } = graph('a b c d', 'a>b c>d d>c');
    assert.ok(detectCycle(edges, nodes));
  });

  // Nothing in this graph has in-degree 0, so Kahn's queue starts empty — the
  // check has to be "did everything drain", not "did the walk find anything".
  test('a cycle with no entry point at all is caught', () => {
    const { nodes, edges } = graph('a b c', 'a>b b>c c>a');
    assert.ok(detectCycle(edges, nodes));
  });

  // The cycle walk runs backwards for this reason: d hangs off the cycle and
  // has nowhere to go forwards, so a forward walk starting there dead-ends.
  test('describes the cycle, not a stage merely stuck behind it', () => {
    const { nodes, edges } = graph('a b c d', 'a>b b>c c>a a>d');
    const cycle = detectCycle(edges, nodes);

    assert.ok(cycle);
    assert.ok(!cycle.includes('d'), `d is downstream of the cycle, not in it: ${cycle.join(' → ')}`);
    assert.deepEqual([...new Set(cycle)].sort(), ['a', 'b', 'c']);
  });

  test('names stages the way the editor does', () => {
    const nodes: CustomNode[] = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'test' } },
      { id: 'n2', position: { x: 0, y: 0 }, data: { type: 'deploy', name: 'ship' } },
    ];
    const edges: Edge[] = [{ id: 'e0', source: 'n1', target: 'n2' }, { id: 'e1', source: 'n2', target: 'n1' }];
    const cycle = detectCycle(edges, nodes);

    assert.ok(cycle);
    assert.deepEqual([...new Set(cycle)].sort(), ['ship', 'test']);
  });
});

describe('findUngatedDeployStages', () => {
  test('a graph with no deploy stages is fine', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    assert.deepEqual(findUngatedDeployStages(edges, nodes), []);
  });

  test('an approval as the immediate parent gates the deploy', () => {
    const { nodes, edges } = graph('ap:approval d:deploy', 'ap>d');
    assert.deepEqual(findUngatedDeployStages(edges, nodes), []);
  });

  // The runner enqueues a stage only once every parent has completed and never
  // auto-enqueues an approval, so the gate holds through any number of hops.
  test('an approval further upstream still gates the deploy', () => {
    const { nodes, edges } = graph('ap:approval b c d:deploy', 'ap>b b>c c>d');
    assert.deepEqual(findUngatedDeployStages(edges, nodes), []);
  });

  test('a deploy with no approval upstream is ungated', () => {
    const { nodes, edges } = graph('a d:deploy', 'a>d');
    assert.deepEqual(names(findUngatedDeployStages(edges, nodes)), ['d']);
  });

  // Previously invisible: the old check iterated edge sources, so a deploy that
  // was never anyone's target was never examined.
  test('a deploy with no parents at all is ungated', () => {
    const { nodes, edges } = graph('a d:deploy', '');
    assert.deepEqual(names(findUngatedDeployStages(edges, nodes)), ['d']);
  });

  // The deploy waits on both parents, so the ungranted approval stalls it
  // whatever the other branch does.
  test('one approval parent gates a deploy that also has a plain parent', () => {
    const { nodes, edges } = graph('ap:approval b d:deploy', 'ap>d b>d');
    assert.deepEqual(findUngatedDeployStages(edges, nodes), []);
  });

  test('an approval on one branch of a diamond gates the deploy', () => {
    const { nodes, edges } = graph('a ap:approval b d:deploy', 'a>ap a>b ap>d b>d');
    assert.deepEqual(findUngatedDeployStages(edges, nodes), []);
  });

  test('an approval downstream of the deploy does not gate it', () => {
    const { nodes, edges } = graph('d:deploy ap:approval', 'd>ap');
    assert.deepEqual(names(findUngatedDeployStages(edges, nodes)), ['d']);
  });

  test('a deploy chained after a gated deploy inherits the gate', () => {
    const { nodes, edges } = graph('ap:approval d1:deploy d2:deploy', 'ap>d1 d1>d2');
    assert.deepEqual(findUngatedDeployStages(edges, nodes), []);
  });

  test('reports only the ungated deploy when others are gated', () => {
    const { nodes, edges } = graph('ap:approval d1:deploy b d2:deploy', 'ap>d1 b>d2');
    assert.deepEqual(names(findUngatedDeployStages(edges, nodes)), ['d2']);
  });

  test('an approval on an unrelated branch does not gate the deploy', () => {
    const { nodes, edges } = graph('a ap:approval b d:deploy', 'a>ap b>d');
    assert.deepEqual(names(findUngatedDeployStages(edges, nodes)), ['d']);
  });

  test('terminates on a cyclic graph', () => {
    const { nodes, edges } = graph('a b d:deploy', 'a>b b>a b>d');
    assert.deepEqual(names(findUngatedDeployStages(edges, nodes)), ['d']);
  });
});

describe('findDanglingEdges', () => {
  test('finds an edge pointing at a stage that is gone', () => {
    const { nodes, edges } = graph('a b', 'a>b b>ghost');
    assert.deepEqual(findDanglingEdges(edges, nodes).map(edge => edge.target), ['ghost']);
  });

  test('finds an edge coming from a stage that is gone', () => {
    const { nodes, edges } = graph('a b', 'ghost>a');
    assert.equal(findDanglingEdges(edges, nodes).length, 1);
  });

  test('a sound graph has none', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    assert.deepEqual(findDanglingEdges(edges, nodes), []);
  });
});

describe('validatePipelineGraph', () => {
  test('a sound gated pipeline passes', () => {
    const { nodes, edges } = graph('build ap:approval d:deploy', 'build>ap ap>d');
    const errors = validatePipelineGraph({ nodes, edges }, configFor(nodes), true);
    assert.deepEqual(errors, []);
  });

  // Approval stages are a human gate — StageConfigForm shows them no command
  // field, so requiring one made every gated pipeline impossible to run.
  test('an approval stage is not required to have a command', () => {
    const { nodes, edges } = graph('build ap:approval d:deploy', 'build>ap ap>d');
    const config = configFor(nodes, { ap: { command: null } });

    assert.deepEqual(validatePipelineGraph({ nodes, edges }, config, true), []);
  });

  // StageTypeGrid labels these stages "Deploy" and "Approval" itself, so the
  // reserved-word rule can only be about a custom stage claiming one.
  test('deploy and approval stages may carry their reserved labels', () => {
    const nodes: CustomNode[] = [
      { id: 'ap', position: { x: 0, y: 0 }, data: { type: 'approval', name: 'gate', label: 'Approval' } },
      { id: 'd', position: { x: 0, y: 0 }, data: { type: 'deploy', name: 'ship', label: 'Deploy' } },
    ];
    const edges: Edge[] = [{ id: 'e0', source: 'ap', target: 'd' }];

    assert.deepEqual(validatePipelineGraph({ nodes, edges }, configFor(nodes), true), []);
  });

  test('a custom stage may not claim a reserved label, in any casing', () => {
    const nodes: CustomNode[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'a', label: '  DePloY ' } },
    ];
    const errors = validatePipelineGraph({ nodes, edges: [] }, configFor(nodes), false);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /Custom stage/);
  });

  test('a whitespace-only command counts as missing', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    const config = configFor(nodes, { a: { command: '   ' } });
    const errors = validatePipelineGraph({ nodes, edges }, config, false);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /missing a command/);
  });

  test('a stage missing from configJson counts as missing a command', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    const config = configFor(nodes);
    delete config.b;

    assert.match(validatePipelineGraph({ nodes, edges }, config, false)[0], /missing a command/);
  });

  test('groups every stage missing a command into one line', () => {
    const { nodes, edges } = graph('a b c', 'a>b b>c');
    const config = configFor(nodes, { a: { command: null }, b: { command: null }, c: { command: null } });
    const errors = validatePipelineGraph({ nodes, edges }, config, false);

    assert.equal(errors.length, 1, 'one line per rule, not per stage');
    assert.match(errors[0], /"a", "b", "c"/);
  });

  test('reports unrelated failures together', () => {
    const { nodes, edges } = graph('a d:deploy', 'a>d');
    const config = configFor(nodes, { a: { command: null } });
    const errors = validatePipelineGraph({ nodes, edges }, config, true);

    assert.equal(errors.length, 2);
    assert.ok(errors.some(error => /missing a command/.test(error)));
    assert.ok(errors.some(error => /Approval stage upstream/.test(error)));
  });

  test('an ungated deploy passes when the environment does not require approval', () => {
    const { nodes, edges } = graph('a d:deploy', 'a>d');
    assert.deepEqual(validatePipelineGraph({ nodes, edges }, configFor(nodes), false), []);
  });

  test('reports a cycle and stops before the approval check', () => {
    const { nodes, edges } = graph('a b d:deploy', 'a>b b>a b>d');
    const errors = validatePipelineGraph({ nodes, edges }, configFor(nodes), true);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /Cycle detected/);
  });

  // A phantom endpoint inflates its own in-degree and reads as a cycle, so the
  // dangling check has to come first and speak alone.
  test('a dangling edge is reported on its own, not as a cycle', () => {
    const { nodes, edges } = graph('a b', 'a>b b>ghost');
    const errors = validatePipelineGraph({ nodes, edges }, configFor(nodes), true);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /no longer exists/);
  });

  test('reports a stage with no name', () => {
    const nodes: CustomNode[] = [{ id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom' } }];
    const errors = validatePipelineGraph({ nodes, edges: [] }, configFor(nodes), false);

    assert.equal(errors.length, 1);
    assert.match(errors[0], /no name/);
  });
});
