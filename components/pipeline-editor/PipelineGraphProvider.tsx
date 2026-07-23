"use client"

import { useCallback, createContext, useContext, useRef, useState, type ReactNode, Dispatch, SetStateAction } from "react";
import { useUndoRedo, type HistoryItem } from './Editor/useUndoRedo';
import { useNodesState, useEdgesState, addEdge, reconnectEdge, OnEdgesChange, type OnNodesChange, type OnNodeDrag, type OnEdgesDelete, type OnReconnect, type Connection, type Edge, type XYPosition } from '@xyflow/react';
import type { CustomNode } from '@/lib/types';

const initialNodes: CustomNode[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'custom', name: 'Stage 1', label: 'Test' }, type: "standardStage" },
  { id: 'n2', position: { x: 0, y: 100 }, data: { type: 'deploy', label: 'Build' }, type: "standardStage" },
  { id: 'n3', position: { x: 0, y: 200 }, data: { type: 'approval', label: 'Build' }, type: "standardStage" },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2', type: 'customEdge', markerEnd: 'marker' }];

type GraphValue = {
  nodes: CustomNode[];
  setNodes: Dispatch<SetStateAction<CustomNode[]>>;
  onNodesChange: OnNodesChange<CustomNode>;
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange<Edge>;
  setPast: Dispatch<SetStateAction<HistoryItem[]>>;
  undo: () => void;
  redo: () => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  onConnect: (params: Connection) => void;
  onEdgesDelete: OnEdgesDelete<Edge>;
  onNodeDragStart: OnNodeDrag<CustomNode>;
  onNodeDragStop: OnNodeDrag<CustomNode>;
  onReconnect: OnReconnect<Edge>;
  selectedEnvironmentId: string | null;
  setSelectedEnvironmentId: Dispatch<SetStateAction<string | null>>;
}

const GraphContext = createContext<GraphValue | null>(null);


export function PipelineGraphProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const { setPast, undo, redo } = useUndoRedo(nodes, setNodes, edges, setEdges);

  const updateNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [setNodes]);

  const onConnect = useCallback((params: Connection) => {
    const edge: Edge = { ...params, id: crypto.randomUUID(), markerEnd: 'marker', type: 'customEdge' };
    setEdges((edges) => addEdge(edge, edges));
    setPast(prevPast => [...prevPast, { ...edge, operation: 'delete' }]);
  }, [setEdges, setPast]);

  // used for when user presses 'Backspace' or 'Del' key on edge
  const onEdgesDelete: OnEdgesDelete<Edge> = (deletedEdges) => {
    setPast(prevPast => [
      ...prevPast,
      ...deletedEdges.map((edge) => ({ ...edge, operation: 'add' as const })),
    ]);
  };

  const dragStartPosition = useRef<{ id: string; position: XYPosition } | null>(null);

  const onNodeDragStart: OnNodeDrag<CustomNode> = (_event, node) => {
    dragStartPosition.current = { id: node.id, position: node.position };
  };

  const onNodeDragStop: OnNodeDrag<CustomNode> = (_event, node) => {
    const start = dragStartPosition.current;
    dragStartPosition.current = null;
    if (!start || start.id !== node.id) return;
    if (start.position.x === node.position.x && start.position.y === node.position.y) return;
    setPast(prevPast => [...prevPast, { ...node, position: start.position, operation: 'move' }]);
  };

  const onReconnect: OnReconnect<Edge> = (oldEdge, newConnection) => {
    setEdges((edges) => reconnectEdge(oldEdge, newConnection, edges, { shouldReplaceId: false }));
    setPast(prevPast => [...prevPast, { ...oldEdge, operation: 'move' }]);
  };

  return (
    <GraphContext.Provider 
      value={{
        nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, updateNodeData, setPast, undo, redo,
        onConnect, onEdgesDelete, onNodeDragStart, onNodeDragStop, onReconnect,
        selectedEnvironmentId, setSelectedEnvironmentId
      }}>
        {children}
    </GraphContext.Provider>
  )
}

export function usePipelineGraph() {
  const ctx = useContext(GraphContext);
  if (!ctx) throw new Error('usePipelineGraph must be used within PipelineGraphProvider');
  return ctx;
}
