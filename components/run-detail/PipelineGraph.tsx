"use client"

import { useState, type CSSProperties } from 'react';
import { ReactFlow, Controls, Edge } from '@xyflow/react';
import PresentableStage from '@/components/run-detail/PresentableStage';
import StageDetailSidebar from '@/components/run-detail/StageDetailSidebar/StageDetailSidebar';
import styles from '@/components/run-detail/StageDetailSidebar/stage-detail-sidebar.module.css';
import CustomEdge from '@/components/flow/CustomEdge';
import CustomMarker from '@/components/flow/CustomMarker';
import '@xyflow/react/dist/style.css';
import { StageResultNode } from '@/lib/data/run-detail';

const nodeTypes = {
  standardStage: PresentableStage
}

const edgeTypes = {
  customEdge: CustomEdge
}

export default function PipelineGraph({nodes, edges} : { nodes: StageResultNode[], edges: Edge[] }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  /* 
  Look the node up by id rather than storing it: AutoRefresh re-renders this
  page every 10s while the run is live, so a captured node object goes stale
  while an id stays valid — and the open panel follows the run's progress.
  */
  const selectedNode = nodes.find(node => node.id === selectedNodeId);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_e, node) => { setSelectedNodeId(node.id); setSidebarOpen(true); }}
        onPaneClick={() => setSidebarOpen(false)}
        fitView
      >
        <CustomMarker />
        <Controls
          style={{
            '--xy-controls-button-background-color': 'var(--controls-btn-clr)',
            '--xy-controls-button-background-color-hover': 'var(--controls-btn-clr-hover)',
            '--xy-controls-button-color': '#ffffff',
            '--xy-controls-button-color-hover': '#ffffff',
          } as CSSProperties}
        />
      </ReactFlow>

      <aside className={`${styles['stage-sidebar']}${sidebarOpen ? ` ${styles.open}` : ''}`}>
        <StageDetailSidebar key={selectedNodeId} node={selectedNode} onClose={() => setSidebarOpen(false)} />
      </aside>
    </>
  );
}
