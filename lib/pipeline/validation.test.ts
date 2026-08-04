import type { Edge } from '@xyflow/react';
import type { CustomNode } from '@/lib/types';
import { detectCycle, findDanglingEdges, findUngatedDeployStages, validatePipelineGraph } from '@/lib/pipeline/validation';
import { graph, configFor, names } from '@/test/helpers/graph';

/*
 * detectCycle returns `string[] | null`. assert.ok used to narrow that for the
 * cases below; expect().not.toBeNull() does not, so narrow explicitly here
 * rather than scattering non-null assertions through the assertions.
 */
function expectCycle(result: string[] | null): string[] {
  expect(result).not.toBeNull();
  return result as string[];
}

describe('detectCycle', () => {
  it('empty graph is acyclic', () => {
    const { nodes, edges } = graph('');
    expect(detectCycle(edges, nodes)).toBeNull();
  });

  it('a lone stage with no edges is acyclic', () => {
    const { nodes, edges } = graph('a');
    expect(detectCycle(edges, nodes)).toBeNull();
  });

  it('a chain is acyclic', () => {
    const { nodes, edges } = graph('a b c d', 'a>b b>c c>d');
    expect(detectCycle(edges, nodes)).toBeNull();
  });

  // A visited-set DFS reports a cycle here because d is reached twice by
  // different paths. Kahn's counts dependencies instead, so it does not.
  it('a diamond is acyclic', () => {
    const { nodes, edges } = graph('a b c d', 'a>b a>c b>d c>d');
    expect(detectCycle(edges, nodes)).toBeNull();
  });

  it('parallel duplicate edges are acyclic', () => {
    const { nodes, edges } = graph('a b', 'a>b a>b');
    expect(detectCycle(edges, nodes)).toBeNull();
  });

  it('a self-loop is a cycle', () => {
    const { nodes, edges } = graph('a', 'a>a');
    expect(detectCycle(edges, nodes)).toEqual(['a', 'a']);
  });

  it('a two-stage cycle is caught regardless of edge order', () => {
    const forwards = graph('a b', 'a>b b>a');
    const backwards = graph('a b', 'b>a a>b');

    expect(detectCycle(forwards.edges, forwards.nodes)).not.toBeNull();
    expect(detectCycle(backwards.edges, backwards.nodes)).not.toBeNull();
  });

  // The case the previous implementation missed: it only compared an edge
  // against the reverse of itself, so nothing longer than two stages registered.
  it('a three-stage cycle is caught', () => {
    const { nodes, edges } = graph('a b c', 'a>b b>c c>a');
    const cycle = expectCycle(detectCycle(edges, nodes));

    // path repeats its entry stage to close the loop
    expect(cycle).toHaveLength(4);
    expect(cycle[0]).toBe(cycle.at(-1));
    expect([...new Set(cycle)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('a cycle is caught in a graph that also has a valid path', () => {
    const { nodes, edges } = graph('a b c d', 'a>b b>c c>b c>d');
    expect(detectCycle(edges, nodes)).not.toBeNull();
  });

  it('a cycle is caught when only one of two components has one', () => {
    const { nodes, edges } = graph('a b c d', 'a>b c>d d>c');
    expect(detectCycle(edges, nodes)).not.toBeNull();
  });

  // Nothing in this graph has in-degree 0, so Kahn's queue starts empty — the
  // check has to be "did everything drain", not "did the walk find anything".
  it('a cycle with no entry point at all is caught', () => {
    const { nodes, edges } = graph('a b c', 'a>b b>c c>a');
    expect(detectCycle(edges, nodes)).not.toBeNull();
  });

  // The cycle walk runs backwards for this reason: d hangs off the cycle and
  // has nowhere to go forwards, so a forward walk starting there dead-ends.
  it('describes the cycle, not a stage merely stuck behind it', () => {
    const { nodes, edges } = graph('a b c d', 'a>b b>c c>a a>d');
    const cycle = expectCycle(detectCycle(edges, nodes));

    // d is downstream of the cycle, not in it
    expect(cycle).not.toContain('d');
    expect([...new Set(cycle)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('names stages the way the editor does', () => {
    const nodes: CustomNode[] = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'test' } },
      { id: 'n2', position: { x: 0, y: 0 }, data: { type: 'deploy', name: 'ship' } },
    ];
    const edges: Edge[] = [{ id: 'e0', source: 'n1', target: 'n2' }, { id: 'e1', source: 'n2', target: 'n1' }];
    const cycle = expectCycle(detectCycle(edges, nodes));

    expect([...new Set(cycle)].sort()).toEqual(['ship', 'test']);
  });
});

describe('findUngatedDeployStages', () => {
  it('a graph with no deploy stages is fine', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    expect(findUngatedDeployStages(edges, nodes)).toEqual([]);
  });

  it('an approval as the immediate parent gates the deploy', () => {
    const { nodes, edges } = graph('ap:approval d:deploy', 'ap>d');
    expect(findUngatedDeployStages(edges, nodes)).toEqual([]);
  });

  // The runner enqueues a stage only once every parent has completed and never
  // auto-enqueues an approval, so the gate holds through any number of hops.
  it('an approval further upstream still gates the deploy', () => {
    const { nodes, edges } = graph('ap:approval b c d:deploy', 'ap>b b>c c>d');
    expect(findUngatedDeployStages(edges, nodes)).toEqual([]);
  });

  it('a deploy with no approval upstream is ungated', () => {
    const { nodes, edges } = graph('a d:deploy', 'a>d');
    expect(names(findUngatedDeployStages(edges, nodes))).toEqual(['d']);
  });

  // Previously invisible: the old check iterated edge sources, so a deploy that
  // was never anyone's target was never examined.
  it('a deploy with no parents at all is ungated', () => {
    const { nodes, edges } = graph('a d:deploy', '');
    expect(names(findUngatedDeployStages(edges, nodes))).toEqual(['d']);
  });

  // The deploy waits on both parents, so the ungranted approval stalls it
  // whatever the other branch does.
  it('one approval parent gates a deploy that also has a plain parent', () => {
    const { nodes, edges } = graph('ap:approval b d:deploy', 'ap>d b>d');
    expect(findUngatedDeployStages(edges, nodes)).toEqual([]);
  });

  it('an approval on one branch of a diamond gates the deploy', () => {
    const { nodes, edges } = graph('a ap:approval b d:deploy', 'a>ap a>b ap>d b>d');
    expect(findUngatedDeployStages(edges, nodes)).toEqual([]);
  });

  it('an approval downstream of the deploy does not gate it', () => {
    const { nodes, edges } = graph('d:deploy ap:approval', 'd>ap');
    expect(names(findUngatedDeployStages(edges, nodes))).toEqual(['d']);
  });

  it('a deploy chained after a gated deploy inherits the gate', () => {
    const { nodes, edges } = graph('ap:approval d1:deploy d2:deploy', 'ap>d1 d1>d2');
    expect(findUngatedDeployStages(edges, nodes)).toEqual([]);
  });

  it('reports only the ungated deploy when others are gated', () => {
    const { nodes, edges } = graph('ap:approval d1:deploy b d2:deploy', 'ap>d1 b>d2');
    expect(names(findUngatedDeployStages(edges, nodes))).toEqual(['d2']);
  });

  it('an approval on an unrelated branch does not gate the deploy', () => {
    const { nodes, edges } = graph('a ap:approval b d:deploy', 'a>ap b>d');
    expect(names(findUngatedDeployStages(edges, nodes))).toEqual(['d']);
  });

  it('terminates on a cyclic graph', () => {
    const { nodes, edges } = graph('a b d:deploy', 'a>b b>a b>d');
    expect(names(findUngatedDeployStages(edges, nodes))).toEqual(['d']);
  });
});

describe('findDanglingEdges', () => {
  it('finds an edge pointing at a stage that is gone', () => {
    const { nodes, edges } = graph('a b', 'a>b b>ghost');
    expect(findDanglingEdges(edges, nodes).map(edge => edge.target)).toEqual(['ghost']);
  });

  it('finds an edge coming from a stage that is gone', () => {
    const { nodes, edges } = graph('a b', 'ghost>a');
    expect(findDanglingEdges(edges, nodes)).toHaveLength(1);
  });

  it('a sound graph has none', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    expect(findDanglingEdges(edges, nodes)).toEqual([]);
  });
});

describe('validatePipelineGraph', () => {
  it('a sound gated pipeline passes', () => {
    const { nodes, edges } = graph('build ap:approval d:deploy', 'build>ap ap>d');
    const errors = validatePipelineGraph({ nodes, edges }, configFor(nodes), true);
    expect(errors).toEqual([]);
  });

  // Approval stages are a human gate — StageConfigForm shows them no command
  // field, so requiring one made every gated pipeline impossible to run.
  it('an approval stage is not required to have a command', () => {
    const { nodes, edges } = graph('build ap:approval d:deploy', 'build>ap ap>d');
    const config = configFor(nodes, { ap: { command: null } });

    expect(validatePipelineGraph({ nodes, edges }, config, true)).toEqual([]);
  });

  // StageTypeGrid labels these stages "Deploy" and "Approval" itself, so the
  // reserved-word rule can only be about a custom stage claiming one.
  it('deploy and approval stages may carry their reserved labels', () => {
    const nodes: CustomNode[] = [
      { id: 'ap', position: { x: 0, y: 0 }, data: { type: 'approval', name: 'gate', label: 'Approval' } },
      { id: 'd', position: { x: 0, y: 0 }, data: { type: 'deploy', name: 'ship', label: 'Deploy' } },
    ];
    const edges: Edge[] = [{ id: 'e0', source: 'ap', target: 'd' }];

    expect(validatePipelineGraph({ nodes, edges }, configFor(nodes), true)).toEqual([]);
  });

  it('a custom stage may not claim a reserved label, in any casing', () => {
    const nodes: CustomNode[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'a', label: '  DePloY ' } },
    ];
    const errors = validatePipelineGraph({ nodes, edges: [] }, configFor(nodes), false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Custom stage/);
  });

  it('a whitespace-only command counts as missing', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    const config = configFor(nodes, { a: { command: '   ' } });
    const errors = validatePipelineGraph({ nodes, edges }, config, false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/missing a command/);
  });

  it('a stage missing from configJson counts as missing a command', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    const config = configFor(nodes);
    delete config.b;

    expect(validatePipelineGraph({ nodes, edges }, config, false)[0]).toMatch(/missing a command/);
  });

  it('groups every stage missing a command into one line', () => {
    const { nodes, edges } = graph('a b c', 'a>b b>c');
    const config = configFor(nodes, { a: { command: null }, b: { command: null }, c: { command: null } });
    const errors = validatePipelineGraph({ nodes, edges }, config, false);

    // one line per rule, not per stage
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/"a", "b", "c"/);
  });

  it('reports unrelated failures together', () => {
    const { nodes, edges } = graph('a d:deploy', 'a>d');
    const config = configFor(nodes, { a: { command: null } });
    const errors = validatePipelineGraph({ nodes, edges }, config, true);

    expect(errors).toHaveLength(2);
    expect(errors.some(error => /missing a command/.test(error))).toBe(true);
    expect(errors.some(error => /Approval stage upstream/.test(error))).toBe(true);
  });

  it('an ungated deploy passes when the environment does not require approval', () => {
    const { nodes, edges } = graph('a d:deploy', 'a>d');
    expect(validatePipelineGraph({ nodes, edges }, configFor(nodes), false)).toEqual([]);
  });

  it('reports a cycle and stops before the approval check', () => {
    const { nodes, edges } = graph('a b d:deploy', 'a>b b>a b>d');
    const errors = validatePipelineGraph({ nodes, edges }, configFor(nodes), true);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Cycle detected/);
  });

  // A phantom endpoint inflates its own in-degree and reads as a cycle, so the
  // dangling check has to come first and speak alone.
  it('a dangling edge is reported on its own, not as a cycle', () => {
    const { nodes, edges } = graph('a b', 'a>b b>ghost');
    const errors = validatePipelineGraph({ nodes, edges }, configFor(nodes), true);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no longer exists/);
  });

  it('reports a stage with no name', () => {
    const nodes: CustomNode[] = [{ id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom' } }];
    const errors = validatePipelineGraph({ nodes, edges: [] }, configFor(nodes), false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no name/);
  });
});
