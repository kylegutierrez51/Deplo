"use client"

import { useCallback, useState, useEffect, type CSSProperties } from 'react';
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

type operation = 'delete' | 'add' | 'move'
 
const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { }, type: "standardStage" },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Build' }, type: "standardStage" },
  { id: 'n3', position: { x: 0, y: 200 }, data: { label: 'Build' }, type: "standardStage" },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2', type: 'customEdge', markerEnd: 'marker' }];
 
export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [past, setPast] = useState<(Edge & { operation: operation } | Node & { operation: operation })[]>([]);
  const [future, setFuture] = useState<((Edge & { operation: operation }) | Node & { operation: operation })[]>([]);

  console.log("past");
  console.log(past);

  const onConnect = useCallback((params: Connection) => {
    const edge: Edge = {...params, id: `${params.source}-${params.target}`, markerEnd: 'marker', type: 'customEdge' };
    setEdges((edges) => addEdge(edge, edges));
    setPast(prevPast => [ ...prevPast, { ...edge, operation: 'delete' } ]);
  }, [setEdges]);

  const onEdgeContextMenu: NonNullable<React.ComponentProps<typeof ReactFlow>['onEdgeContextMenu']> = (event, edge) => {
    event.preventDefault();
    setContextMenu({ id: edge.id, x: event.clientX, y: event.clientY });
  };

  const onDeleteEdge = () => {
    if (!contextMenu) return;
    const deletedEdge = edges.find((edge) => edge.id === contextMenu.id);
    setEdges((edges) => edges.filter((edge) => edge.id !== contextMenu.id));
    setContextMenu(null);
    if (deletedEdge) setPast(prevPast => [ ...prevPast, { ...deletedEdge, operation: 'add' } ]);
  };

  const undo = useCallback(() => {
    if (!past.length) return;
    const item = past.at(-1);
    setPast(prev => prev.slice(0, -1));
    if (!item) return;

    const inverseOperation = item.operation === 'delete' ? 'add' : item.operation === 'add' ? 'delete' : 'move';
    setFuture(prevFuture => [ ...prevFuture, { ...item, operation: inverseOperation } ]);



    if (item?.operation === 'delete') {
      if (item && 'source' in item) setEdges(edges => edges.filter((edge) => edge.id !== item.id));
      else setNodes(nodes => nodes.filter((node) => node.id !== item.id));
    }

    if (item?.operation === 'add') {
      if (item && 'source' in item) {
        const { operation, ...restoredEdge } = item;
        setEdges((edges) => addEdge(restoredEdge, edges));
      } else if (item) {
        const { operation, ...restoredNode } = item;
        setNodes((nodes) => [...nodes, restoredNode]);
      }
    }
  }, [past, setEdges, setNodes]);


  const redo = useCallback(() => {
    if (!future.length) return;
    const item = future.at(-1);
    setFuture(future => future.slice(0, -1));
    if (!item) return;

    const inverseOperation = item.operation === 'delete' ? 'add' : item.operation === 'add' ? 'delete' : 'move';
    setPast(prevPast => [ ...prevPast, { ...item, operation: inverseOperation } ]);



    if (item?.operation === 'delete') {
      if (item && 'source' in item) setEdges(edges => edges.filter((edge) => edge.id !== item.id));
      else setNodes(nodes => nodes.filter((node) => node.id !== item.id));
    }

    if (item?.operation === 'add') {
      if (item && 'source' in item) {
        const { operation, ...restoredEdge } = item;
        setEdges((edges) => addEdge(restoredEdge, edges));
      } else if (item) {
        const { operation, ...restoredNode } = item;
        setNodes((nodes) => [...nodes, restoredNode]);
      }
    }
  }, [future, setEdges, setNodes])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        undo();
      } else if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

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