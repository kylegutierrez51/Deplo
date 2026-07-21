import { useState, useCallback, createContext, type ReactNode, Dispatch, SetStateAction } from "react";
import { useUndoRedo, type HistoryItem } from './Editor/useUndoRedo';
import { type Edge, type Node, OnEdgesChange, OnNodesChange, useEdgesState, useNodesState } from "@xyflow/react";

const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { name: 'Stage 1', label: 'Test' }, type: "standardStage" },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Build' }, type: "standardStage" },
  { id: 'n3', position: { x: 0, y: 200 }, data: { label: 'Build' }, type: "standardStage" },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2', type: 'customEdge', markerEnd: 'marker' }];

type GraphValue = {
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  edges: Edge[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange<Edge>;
  setPast: Dispatch<SetStateAction<HistoryItem[]>>;
  undo: () => void;
  redo: () => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}

const GraphContext = createContext<GraphValue | null>(null)


export function PipelineGraphProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { setPast, undo, redo } = useUndoRedo(nodes, setNodes, edges, setEdges);

  const updateNodeData = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [setNodes]); 

  return (
    <GraphContext.Provider 
      value={{ 
        nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, updateNodeData, setPast, undo, redo
      }}>
        {children}
    </GraphContext.Provider>
  )
}