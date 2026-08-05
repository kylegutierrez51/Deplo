import { buildMaps } from '@/lib/pipeline/adjacency';
import { graph } from '@/test/helpers/graph';

/*
 * buildMaps is shared between validation (Kahn's) and the runner's scheduler, so
 * its edge cases are load-bearing in two places at once. It was previously only
 * exercised transitively through detectCycle.
 */

describe('buildMaps', () => {
  it('seeds every node at in-degree 0 so isolated stages are represented', () => {
    const { nodes, edges } = graph('a b c');
    const { inDegree, adjacency } = buildMaps(edges, nodes);

    expect([...inDegree.entries()]).toEqual([['a', 0], ['b', 0], ['c', 0]]);
    expect(adjacency.size).toBe(0);
  });

  it('counts incoming edges per target', () => {
    const { nodes, edges } = graph('a b c', 'a>c b>c');

    expect(buildMaps(edges, nodes).inDegree.get('c')).toBe(2);
  });

  it('records outgoing targets per source', () => {
    const { nodes, edges } = graph('a b c', 'a>b a>c');

    expect(buildMaps(edges, nodes).adjacency.get('a')).toEqual(['b', 'c']);
  });

  it('gives a sink no adjacency entry at all', () => {
    const { nodes, edges } = graph('a b', 'a>b');
    const { adjacency } = buildMaps(edges, nodes);

    expect(adjacency.has('b')).toBe(false);
  });

  // Two parallel edges are still two dependencies as far as the counter is
  // concerned, so the target needs both decrements before it becomes ready.
  it('counts duplicate parallel edges twice', () => {
    const { nodes, edges } = graph('a b', 'a>b a>b');
    const { inDegree, adjacency } = buildMaps(edges, nodes);

    expect(inDegree.get('b')).toBe(2);
    expect(adjacency.get('a')).toEqual(['b', 'b']);
  });

  // This is exactly why validatePipelineGraph runs findDanglingEdges first: a
  // phantom target invents its own in-degree entry and then never drains, which
  // Kahn's reports as a cycle.
  it('silently invents an entry for an edge pointing at a missing node', () => {
    const { nodes } = graph('a');
    const edges = [{ id: 'e0', source: 'a', target: 'ghost' }];
    const { inDegree } = buildMaps(edges, nodes);

    expect(inDegree.get('ghost')).toBe(1);
    expect(nodes.map(n => n.id)).not.toContain('ghost');
  });

  it('does not invent an in-degree entry for a missing source', () => {
    const { nodes } = graph('a');
    const edges = [{ id: 'e0', source: 'ghost', target: 'a' }];
    const { inDegree, adjacency } = buildMaps(edges, nodes);

    expect(inDegree.has('ghost')).toBe(false);
    expect(adjacency.get('ghost')).toEqual(['a']);
  });

  it('handles a self-loop by counting the node as its own dependency', () => {
    const { nodes, edges } = graph('a', 'a>a');
    const { inDegree, adjacency } = buildMaps(edges, nodes);

    expect(inDegree.get('a')).toBe(1);
    expect(adjacency.get('a')).toEqual(['a']);
  });

  it('returns empty maps for an empty graph', () => {
    const { inDegree, adjacency } = buildMaps([], []);

    expect(inDegree.size).toBe(0);
    expect(adjacency.size).toBe(0);
  });

  it('leaves a diamond with the join depending on both branches', () => {
    const { nodes, edges } = graph('a b c d', 'a>b a>c b>d c>d');
    const { inDegree } = buildMaps(edges, nodes);

    expect([...inDegree.entries()]).toEqual([['a', 0], ['b', 1], ['c', 1], ['d', 2]]);
  });
});
