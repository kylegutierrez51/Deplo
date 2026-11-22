"use client"

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ReactFlow, Controls, type Edge, type ReactFlowInstance } from '@xyflow/react';
import PresentableStage from '@/components/run-detail/PresentableStage';
import StageDetailSidebar from '@/components/run-detail/StageDetailSidebar/StageDetailSidebar';
import detailStyles from '@/components/run-detail/StageDetailSidebar/stage-detail-sidebar.module.css';
import panelStyles from '@/components/ui/stage-panel.module.css';
import CustomEdge from '@/components/flow/CustomEdge';
import CustomMarker from '@/components/flow/CustomMarker';
import '@xyflow/react/dist/style.css';
import { StageResultNode } from '@/lib/data/run-detail';


const styles = { ...panelStyles, ...detailStyles };

const nodeTypes = {
  standardStage: PresentableStage
}

const edgeTypes = {
  customEdge: CustomEdge
}

export default function PipelineGraph({nodes, edges, envPresent} : { nodes: StageResultNode[], edges: Edge[], envPresent: boolean }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // holds React Flow's control API, giving us methods like `fitView`
  const [flow, setFlow] = useState<ReactFlowInstance<StageResultNode, Edge> | null>(null);

  // Refit when the canvas resizes or returns from Logs, preserving manual pan/zoom otherwise. Runs (and starts observing) when the graph initializes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !flow) return;
    const observer = new ResizeObserver(entries => {
      if (entries.some(entry => entry.contentRect.width > 0 && entry.contentRect.height > 0)) {
        void flow.fitView({ padding: 0.2 });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [flow]);

  const selectedNode = nodes.find(node => node.id === selectedNodeId);

  return (
    <div ref={containerRef} className={styles['graph-viewport']}>
      <ReactFlow<StageResultNode, Edge>
        onInit={setFlow}
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

      <aside className={`${styles['stage-sidebar']} ${styles['detail-sidebar']}${sidebarOpen ? ` ${styles.open}` : ''}`}>
        <StageDetailSidebar key={selectedNodeId} node={selectedNode} envPresent={envPresent} onClose={() => setSidebarOpen(false)} />
      </aside>
    </div>
  );
}
