"use client"

import { useCallback, useRef, useState, useEffect, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Panel, useNodesState, useEdgesState, addEdge, reconnectEdge, type Connection, type Node, type Edge, type XYPosition, type ReactFlowInstance } from '@xyflow/react';
import Stage from './Stage';
import CustomEdge from './CustomEdge';
import CustomMarker from './CustomMarker';
import { useUndoRedo } from './useUndoRedo';
import editorStyles from './editor.module.css';
import headerButtonStyles from '../header-buttons.module.css';
import '@xyflow/react/dist/style.css';

const styles = { ...editorStyles, ...headerButtonStyles };

const nodeTypes = {
  standardStage: Stage
}

const edgeTypes = {
  customEdge: CustomEdge
}

const INIT_STAGE_WIDTH = 450;
const INIT_STAGE_HEIGHT = 104;

const initialNodes = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { }, type: "standardStage" },
  { id: 'n2', position: { x: 0, y: 100 }, data: { label: 'Build' }, type: "standardStage" },
  { id: 'n3', position: { x: 0, y: 200 }, data: { label: 'Build' }, type: "standardStage" },
];
const initialEdges: Edge[] = [{ id: 'n1-n2', source: 'n1', target: 'n2', type: 'customEdge', markerEnd: 'marker' }];
 
export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [contextMenu, setContextMenu] = useState<{ id: string; type: 'node' | 'edge'; x: number; y: number } | null>(null);
  const { setPast, undo, redo } = useUndoRedo(nodes, setNodes, edges, setEdges);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  const onAddStage = useCallback(() => {
    const wrapperBounds = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperBounds || !reactFlowInstanceRef.current) return;

    const position = reactFlowInstanceRef.current.screenToFlowPosition({
      x: wrapperBounds.x + wrapperBounds.width / 2 - (INIT_STAGE_WIDTH / 2),
      y: wrapperBounds.y + wrapperBounds.height / 2 - (INIT_STAGE_HEIGHT / 2),
    });
    const newNode: Node = { id: crypto.randomUUID(), position, data: {}, type: 'standardStage' };
    setNodes((nodes) => [...nodes, newNode]);
    setPast(prevPast => [ ...prevPast, { ...newNode, operation: 'delete' } ]);
  }, [setNodes, setPast]);

  const onConnect = useCallback((params: Connection) => {
    const edge: Edge = {...params, id: crypto.randomUUID(), markerEnd: 'marker', type: 'customEdge' };
    setEdges((edges) => addEdge(edge, edges));
    setPast(prevPast => [ ...prevPast, { ...edge, operation: 'delete' } ]);
  }, [setEdges, setPast]);

  const onEdgeContextMenu: NonNullable<React.ComponentProps<typeof ReactFlow>['onEdgeContextMenu']> = (event, edge) => {
    event.preventDefault();
    setContextMenu({ id: edge.id, type: 'edge', x: event.clientX, y: event.clientY });
  };

  const onNodeContextMenu: NonNullable<React.ComponentProps<typeof ReactFlow>['onNodeContextMenu']> = (event, node) => {
    event.preventDefault();
    setContextMenu({ id: node.id, type: 'node', x: event.clientX, y: event.clientY });
  };

  const onDeleteEdge = () => {
    if (!contextMenu || contextMenu.type !== 'edge') return;
    const deletedEdge = edges.find((edge) => edge.id === contextMenu.id);
    setEdges((edges) => edges.filter((edge) => edge.id !== contextMenu.id));
    setContextMenu(null);
    if (deletedEdge) setPast(prevPast => [ ...prevPast, { ...deletedEdge, operation: 'add' } ]);
  };

  const onDeleteNode = () => {
    if (!contextMenu || contextMenu.type !== 'node') return;
    const deletedNode = nodes.find((node) => node.id === contextMenu.id);
    const connectedEdges = edges.filter((edge) => edge.source === contextMenu.id || edge.target === contextMenu.id);
    setNodes((nodes) => nodes.filter((node) => node.id !== contextMenu.id));
    setEdges((edges) => edges.filter((edge) => edge.source !== contextMenu.id && edge.target !== contextMenu.id));
    setContextMenu(null);
    setPast(prevPast => [
      ...prevPast,
      ...connectedEdges.map((edge) => ({ ...edge, operation: 'add' as const })),
      ...(deletedNode ? [{ ...deletedNode, operation: 'add' as const }] : []),
    ]);
  };

  // used for when user presses 'Backspace' or 'Del' key on edge
  const onEdgesDelete: NonNullable<React.ComponentProps<typeof ReactFlow>['onEdgesDelete']> = (deletedEdges) => {
    setPast(prevPast => [
      ...prevPast,
      ...deletedEdges.map((edge) => ({ ...edge, operation: 'add' as const })),
    ]);
  };

  // used for when user presses 'Backspace' or 'Del' key on node
  const onNodesDelete: NonNullable<React.ComponentProps<typeof ReactFlow>['onNodesDelete']> = (deletedNodes) => {
    setPast(prevPast => [
      ...prevPast,
      ...deletedNodes.map((node) => ({ ...node, operation: 'add' as const })),
    ]);
  };

  const dragStartPosition = useRef<{ id: string; position: XYPosition } | null>(null);

  const onNodeDragStart: NonNullable<React.ComponentProps<typeof ReactFlow>['onNodeDragStart']> = (_event, node) => {
    dragStartPosition.current = { id: node.id, position: node.position };
  };

  const onNodeDragStop: NonNullable<React.ComponentProps<typeof ReactFlow>['onNodeDragStop']> = (_event, node) => {
    const start = dragStartPosition.current;
    dragStartPosition.current = null;
    if (!start || start.id !== node.id) return;
    if (start.position.x === node.position.x && start.position.y === node.position.y) return;
    setPast(prevPast => [ ...prevPast, { ...node, position: start.position, operation: 'move' } ]);
  };

  const onReconnect: NonNullable<React.ComponentProps<typeof ReactFlow>['onReconnect']> = (oldEdge, newConnection) => {
    setEdges((edges) => reconnectEdge(oldEdge, newConnection, edges, { shouldReplaceId: false }));
    setPast(prevPast => [ ...prevPast, { ...oldEdge, operation: 'move' } ]);
  };

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
    <div ref={wrapperRef} className={styles['editor-wrapper']}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onInit={(instance) => { reactFlowInstanceRef.current = instance; }}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onReconnect={onReconnect}
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
        <Panel position="top-left">
          <button type="button" className={styles['add-stage-btn']} onClick={onAddStage}>
            <ion-icon name="add-outline"></ion-icon>
            Add Stage
          </button>
        </Panel>
        {contextMenu && (
          <div
            className={styles['context-menu']}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={contextMenu.type === 'edge' ? onDeleteEdge : onDeleteNode}
          >
            <p>Delete</p>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}