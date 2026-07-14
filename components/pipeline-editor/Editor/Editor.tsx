"use client"

import { useState, useCallback, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, type Connection, type Node, type Edge } from '@xyflow/react';
import Stage from './Stage';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  standardStage: Stage
}
 
const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { }, type: "standardStage" },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Build' }, type: "standardStage" },
  { id: 'n3', position: { x: 0, y: 200 }, data: { label: 'Build' }, type: "standardStage" },
];
// const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2' }];
 
export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const onConnect = useCallback((params: Connection) => (
    setEdges((edges) => addEdge(params, edges))
  ), [setEdges])
 
  return (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        fitView
        >
        <Background />
        <Controls
          style={{
            '--xy-controls-button-background-color': 'var(--controls-btn-clr)',
            '--xy-controls-button-background-color-hover': 'var(--controls-btn-clr-hover)',
            '--xy-controls-button-color': '#ffffff',
            '--xy-controls-button-color-hover': '#ffffff',
          } as CSSProperties}
        />
      </ReactFlow>
  );
}