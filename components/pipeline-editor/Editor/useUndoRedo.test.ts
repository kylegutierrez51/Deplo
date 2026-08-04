import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { Edge } from '@xyflow/react';
import { useUndoRedo, type HistoryItem } from '@/components/pipeline-editor/Editor/useUndoRedo';
import type { CustomNode } from '@/lib/types';

/*
 * The hook holds two stacks and moves entries between them, inverting the
 * operation on the way. Callers push the *inverse* of what they just did: adding
 * a node pushes { ...node, operation: 'delete' }, so undoing it deletes.
 *
 * A small harness stands in for the editor, holding nodes and edges in state so
 * the hook's setters actually apply.
 */

const node = (id: string, x = 0, y = 0): CustomNode => ({
  id, position: { x, y }, data: { type: 'custom', name: id },
});

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

function useHarness(initialNodes: CustomNode[] = [], initialEdges: Edge[] = []) {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const history = useUndoRedo(nodes, setNodes, edges, setEdges);
  return { nodes, edges, ...history };
}

const renderEditor = (nodes: CustomNode[] = [], edges: Edge[] = []) =>
  renderHook(() => useHarness(nodes, edges));

/** Records the inverse of an action, the way the editor's handlers do. */
const push = (result: { current: { setPast: (fn: (p: HistoryItem[]) => HistoryItem[]) => void } }, item: HistoryItem) =>
  act(() => { result.current.setPast(prev => [...prev, item]); });

describe('undo with an empty stack', () => {
  it('does nothing', () => {
    const { result } = renderEditor([node('a')]);

    act(() => { result.current.undo(); });

    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
  });

  it('leaves redo with nothing to do either', () => {
    const { result } = renderEditor([node('a')]);

    act(() => { result.current.undo(); result.current.redo(); });

    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
  });
});

describe('undoing an added node', () => {
  // Adding pushes operation 'delete' — the inverse of what happened.
  it('removes the node', () => {
    const { result } = renderEditor([node('a'), node('b')]);
    push(result, { ...node('b'), operation: 'delete' });

    act(() => { result.current.undo(); });

    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
  });

  it('restores it on redo', () => {
    const { result } = renderEditor([node('a'), node('b')]);
    push(result, { ...node('b'), operation: 'delete' });

    act(() => { result.current.undo(); });
    act(() => { result.current.redo(); });

    expect(result.current.nodes.map(n => n.id).sort()).toEqual(['a', 'b']);
  });
});

describe('undoing a deleted node', () => {
  it('puts the node back', () => {
    const { result } = renderEditor([node('a')]);
    push(result, { ...node('deleted'), operation: 'add' });

    act(() => { result.current.undo(); });

    expect(result.current.nodes.map(n => n.id).sort()).toEqual(['a', 'deleted']);
  });

  it('restores its position, not just its id', () => {
    const { result } = renderEditor([]);
    push(result, { ...node('a', 120, 340), operation: 'add' });

    act(() => { result.current.undo(); });

    expect(result.current.nodes[0].position).toEqual({ x: 120, y: 340 });
  });

  // The `operation` marker is bookkeeping and must not survive onto the node.
  it('does not leave the operation marker on the restored node', () => {
    const { result } = renderEditor([]);
    push(result, { ...node('a'), operation: 'add' });

    act(() => { result.current.undo(); });

    expect(result.current.nodes[0]).not.toHaveProperty('operation');
  });

  it('deletes it again on redo', () => {
    const { result } = renderEditor([]);
    push(result, { ...node('a'), operation: 'add' });

    act(() => { result.current.undo(); });
    act(() => { result.current.redo(); });

    expect(result.current.nodes).toEqual([]);
  });
});

describe('edges', () => {
  // The 'source' in item check is what tells an edge from a node.
  it('undoes a connection by removing the edge', () => {
    const { result } = renderEditor([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    push(result, { ...edge('e1', 'a', 'b'), operation: 'delete' });

    act(() => { result.current.undo(); });

    expect(result.current.edges).toEqual([]);
  });

  it('undoes an edge deletion by restoring it', () => {
    const { result } = renderEditor([node('a'), node('b')], []);
    push(result, { ...edge('e1', 'a', 'b'), operation: 'add' });

    act(() => { result.current.undo(); });

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0]).toMatchObject({ source: 'a', target: 'b' });
  });

  it('does not touch nodes when undoing an edge operation', () => {
    const { result } = renderEditor([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    push(result, { ...edge('e1', 'a', 'b'), operation: 'delete' });

    act(() => { result.current.undo(); });

    expect(result.current.nodes.map(n => n.id)).toEqual(['a', 'b']);
  });
});

describe('undoing a move', () => {
  // A move stores the *previous* position, and undo swaps it with the current
  // one so redo can put it back.
  it('returns the node to where it started', () => {
    const { result } = renderEditor([node('a', 500, 500)]);
    push(result, { ...node('a', 10, 20), operation: 'move' });

    act(() => { result.current.undo(); });

    expect(result.current.nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('moves it back again on redo', () => {
    const { result } = renderEditor([node('a', 500, 500)]);
    push(result, { ...node('a', 10, 20), operation: 'move' });

    act(() => { result.current.undo(); });
    act(() => { result.current.redo(); });

    expect(result.current.nodes[0].position).toEqual({ x: 500, y: 500 });
  });

  it('survives undoing a move of a node that is gone', () => {
    const { result } = renderEditor([node('a')]);
    push(result, { ...node('deleted', 1, 2), operation: 'move' });

    expect(() => act(() => { result.current.undo(); })).not.toThrow();
    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
  });
});

describe('stack ordering', () => {
  it('undoes in reverse order', () => {
    const { result } = renderEditor([node('a'), node('b'), node('c')]);
    push(result, { ...node('b'), operation: 'delete' });
    push(result, { ...node('c'), operation: 'delete' });

    act(() => { result.current.undo(); });
    expect(result.current.nodes.map(n => n.id)).toEqual(['a', 'b']);

    act(() => { result.current.undo(); });
    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
  });

  it('round-trips a whole sequence back to where it began', () => {
    const { result } = renderEditor([node('a'), node('b'), node('c')]);
    push(result, { ...node('b'), operation: 'delete' });
    push(result, { ...node('c'), operation: 'delete' });

    act(() => { result.current.undo(); });
    act(() => { result.current.undo(); });
    act(() => { result.current.redo(); });
    act(() => { result.current.redo(); });

    expect(result.current.nodes.map(n => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  // Deleting a node pushes its edges alongside it, so one undo has to restore
  // the whole group — which the editor does by pushing several entries and the
  // user pressing undo once per entry.
  it('treats each pushed entry as its own undo step', () => {
    const { result } = renderEditor([]);
    push(result, { ...edge('e1', 'a', 'b'), operation: 'add' });
    push(result, { ...node('a'), operation: 'add' });

    act(() => { result.current.undo(); });
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.edges).toHaveLength(0);

    act(() => { result.current.undo(); });
    expect(result.current.edges).toHaveLength(1);
  });
});
