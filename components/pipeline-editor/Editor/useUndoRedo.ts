import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { addEdge, type Edge, type Node } from '@xyflow/react';

export type Operation = 'delete' | 'add' | 'move';
export type HistoryItem = (Edge & { operation: Operation }) | (Node & { operation: Operation });

export function useUndoRedo(
  nodes: Node[],
  setNodes: Dispatch<SetStateAction<Node[]>>,
  edges: Edge[],
  setEdges: Dispatch<SetStateAction<Edge[]>>,
) {
  const [past, setPast] = useState<HistoryItem[]>([]);
  const [future, setFuture] = useState<HistoryItem[]>([]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const item = past.at(-1);
    setPast(prev => prev.slice(0, -1));
    if (!item) return;

    if (item.operation === 'move') {
      if ('source' in item) {
        const currentEdge = edges.find((edge) => edge.id === item.id);
        if (currentEdge) setFuture(prevFuture => [ ...prevFuture, { ...currentEdge, operation: 'move' } ]);
        setEdges((edges) => edges.map((edge) => edge.id === item.id
          ? { ...edge, source: item.source, target: item.target, sourceHandle: item.sourceHandle, targetHandle: item.targetHandle }
          : edge));
      } else {
        const currentNode = nodes.find((node) => node.id === item.id);
        if (currentNode) setFuture(prevFuture => [ ...prevFuture, { ...currentNode, operation: 'move' } ]);
        setNodes((nodes) => nodes.map((node) => node.id === item.id ? { ...node, position: item.position } : node));
      }
      return;
    }

    const inverseOperation = item.operation === 'delete' ? 'add' : 'delete';
    setFuture(prevFuture => [ ...prevFuture, { ...item, operation: inverseOperation } ]);

    if (item.operation === 'delete') {
      if ('source' in item) setEdges(edges => edges.filter((edge) => edge.id !== item.id));
      else setNodes(nodes => nodes.filter((node) => node.id !== item.id));
    }

    if (item.operation === 'add') {
      if ('source' in item) {
        const { operation, ...restoredEdge } = item;
        setEdges((edges) => addEdge(restoredEdge, edges));
      } else {
        const { operation, ...restoredNode } = item;
        setNodes((nodes) => [...nodes, restoredNode]);
      }
    }
  }, [past, edges, nodes, setEdges, setNodes]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const item = future.at(-1);
    setFuture(prev => prev.slice(0, -1));
    if (!item) return;

    if (item.operation === 'move') {
      if ('source' in item) {
        const currentEdge = edges.find((edge) => edge.id === item.id);
        if (currentEdge) setPast(prevPast => [ ...prevPast, { ...currentEdge, operation: 'move' } ]);
        setEdges((edges) => edges.map((edge) => edge.id === item.id
          ? { ...edge, source: item.source, target: item.target, sourceHandle: item.sourceHandle, targetHandle: item.targetHandle }
          : edge));
      } else {
        const currentNode = nodes.find((node) => node.id === item.id);
        if (currentNode) setPast(prevPast => [ ...prevPast, { ...currentNode, operation: 'move' } ]);
        setNodes((nodes) => nodes.map((node) => node.id === item.id ? { ...node, position: item.position } : node));
      }
      return;
    }

    const inverseOperation = item.operation === 'delete' ? 'add' : 'delete';
    setPast(prevPast => [ ...prevPast, { ...item, operation: inverseOperation } ]);

    if (item.operation === 'delete') {
      if ('source' in item) setEdges(edges => edges.filter((edge) => edge.id !== item.id));
      else setNodes(nodes => nodes.filter((node) => node.id !== item.id));
    }

    if (item.operation === 'add') {
      if ('source' in item) {
        const { operation, ...restoredEdge } = item;
        setEdges((edges) => addEdge(restoredEdge, edges));
      } else {
        const { operation, ...restoredNode } = item;
        setNodes((nodes) => [...nodes, restoredNode]);
      }
    }
  }, [future, edges, nodes, setEdges, setNodes]);

  return { setPast, setFuture, undo, redo };
}
