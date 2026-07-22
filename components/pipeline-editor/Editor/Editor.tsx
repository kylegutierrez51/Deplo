"use client"

import { useCallback, useRef, useState, useEffect, type CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Panel, type Edge, type ReactFlowInstance, type OnNodesDelete, type NodeMouseHandler, type EdgeMouseHandler } from '@xyflow/react';
import type { CustomNode } from '@/lib/types';
import { usePipelineGraph } from '../PipelineGraphProvider';
import Stage from './Stage';
import StageSidebar from "@/components/pipeline-editor/StageSidebar/StageSidebar";
import CustomEdge from './CustomEdge';
import CustomMarker from './CustomMarker';
import editorStyles from './editor.module.css';
import headerButtonStyles from '../header-buttons.module.css';
import stageStyles from "@/components/pipeline-editor/StageSidebar/stage-sidebar.module.css";
import '@xyflow/react/dist/style.css';

const styles = { ...editorStyles, ...headerButtonStyles, ...stageStyles };

const nodeTypes = {
  standardStage: Stage
}

const edgeTypes = {
  customEdge: CustomEdge
}

const INIT_STAGE_WIDTH = 450;
const INIT_STAGE_HEIGHT = 104;

export default function Editor() {
  const {
    nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, setPast, undo, redo,
    onConnect, onEdgesDelete, onNodeDragStart, onNodeDragStop, onReconnect,
  } = usePipelineGraph();
  
  const [contextMenu, setContextMenu] = useState<{ id: string; type: 'node' | 'edge'; x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<CustomNode, Edge> | null>(null);
  const [toggleStageSidebar, setToggleStageSidebar] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onAddStage = useCallback(() => {
    const wrapperBounds = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperBounds || !reactFlowInstanceRef.current) return;

    const position = reactFlowInstanceRef.current.screenToFlowPosition({
      x: wrapperBounds.x + wrapperBounds.width / 2 - (INIT_STAGE_WIDTH / 2),
      y: wrapperBounds.y + wrapperBounds.height / 2 - (INIT_STAGE_HEIGHT / 2),
    });
    const newNode: CustomNode = { id: crypto.randomUUID(), position, data: { type: 'custom' }, type: 'standardStage' };
    setNodes((nodes) => [...nodes, newNode]);
    setPast(prevPast => [...prevPast, { ...newNode, operation: 'delete' }]);
  }, [setNodes, setPast]);

  const onEdgeContextMenu: EdgeMouseHandler<Edge> = (event, edge) => {
    event.preventDefault();
    setContextMenu({ id: edge.id, type: 'edge', x: event.clientX, y: event.clientY });
  };

  const onNodeContextMenu: NodeMouseHandler<CustomNode> = (event, node) => {
    event.preventDefault();
    setContextMenu({ id: node.id, type: 'node', x: event.clientX, y: event.clientY });
  };

  const onDeleteEdge = () => {
    if (!contextMenu || contextMenu.type !== 'edge') return;
    const deletedEdge = edges.find((edge) => edge.id === contextMenu.id);
    setEdges((edges) => edges.filter((edge) => edge.id !== contextMenu.id));
    setContextMenu(null);
    if (deletedEdge) setPast(prevPast => [...prevPast, { ...deletedEdge, operation: 'add' }]);
  };

  const onDeleteNode = () => {
    if (!contextMenu || contextMenu.type !== 'node') return;
    const deletedNode = nodes.find((node) => node.id === contextMenu.id);
    const connectedEdges = edges.filter((edge) => edge.source === contextMenu.id || edge.target === contextMenu.id);
    setNodes((nodes) => nodes.filter((node) => node.id !== contextMenu.id));
    setEdges((edges) => edges.filter((edge) => edge.source !== contextMenu.id && edge.target !== contextMenu.id));
    setContextMenu(null);
    setToggleStageSidebar(false);
    setPast(prevPast => [
      ...prevPast,
      ...connectedEdges.map((edge) => ({ ...edge, operation: 'add' as const })),
      ...(deletedNode ? [{ ...deletedNode, operation: 'add' as const }] : []),
    ]);
  };

  // used for when user presses 'Backspace' or 'Del' key on node
  const onNodesDelete: OnNodesDelete<CustomNode> = (deletedNodes) => {
    setToggleStageSidebar(false);
    setPast(prevPast => [
      ...prevPast,
      ...deletedNodes.map((node) => ({ ...node, operation: 'add' as const })),
    ]);
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
        onNodeClick={(_e, node) => {
          setSelectedNodeId(node.id);
          setToggleStageSidebar(true);
        }}
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

      <aside className={`${styles['stage-sidebar']} ${toggleStageSidebar ? ` ${styles.open}` : ''}`}>
        <StageSidebar key={selectedNodeId} node={nodes.find(node => node.id === selectedNodeId)} setStageSidebarOpen={setToggleStageSidebar} />
      </aside>
    </div>
  );
}