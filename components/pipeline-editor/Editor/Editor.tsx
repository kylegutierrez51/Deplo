"use client"

import { useCallback, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, type Connection, type Node, type Edge } from '@xyflow/react';
import Stage from './Stage';
import CustomEdge from './CustomEdge';
import CustomMarker from './CustomMarker';
import styles from './editor.module.css';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
  standardStage: Stage
}

const edgeTypes = {
  customEdge: CustomEdge
}
 
const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { }, type: "standardStage" },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Build' }, type: "standardStage" },
  { id: 'n3', position: { x: 0, y: 200 }, data: { label: 'Build' }, type: "standardStage" },
];
const initialEdges = [{ id: 'n1-n2', source: 'n1', target: 'n2', type: 'customEdge', markerEnd: 'marker' }];
 
export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const onConnect = useCallback((params: Connection) => {
    const edge = {...params, markerEnd: 'marker', type: 'customEdge' };
    setEdges((edges) => addEdge(edge, edges))
  }, [setEdges])

  const onEdgeContextMenu: NonNullable<React.ComponentProps<typeof ReactFlow>['onEdgeContextMenu']> = (event, edge) => {
    event.preventDefault();
    setContextMenu({ id: edge.id, x: event.clientX, y: event.clientY });
  };

  const onDeleteEdge = () => {
    if (!contextMenu) return;
    setEdges((edges) => edges.filter((edge) => edge.id !== contextMenu.id));
    setContextMenu(null);
  };

  return (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        >
        <CustomMarker />
        <Background />
        <Controls
          style={{
            '--xy-controls-button-background-color': 'var(--controls-btn-clr)',
            '--xy-controls-button-background-color-hover': 'var(--controls-btn-clr-hover)',
            '--xy-controls-button-color': '#ffffff',
            '--xy-controls-button-color-hover': '#ffffff',
          } as CSSProperties}
        />
        {contextMenu && (
          <div
            className={styles['context-menu']}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={onDeleteEdge}
          >
            <p>Delete</p>
          </div>
        )}
      </ReactFlow>
  );
}