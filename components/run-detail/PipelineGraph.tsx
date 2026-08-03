"use client"

import { type CSSProperties } from 'react';
import { ReactFlow, Controls, Edge } from '@xyflow/react';
import PresentableStage from '@/components/run-detail/PresentableStage';
import CustomEdge from '@/components/flow/CustomEdge';
import CustomMarker from '@/components/flow/CustomMarker';
import '@xyflow/react/dist/style.css';
import { CustomNode } from '@/lib/types';

const nodeTypes = {
  standardStage: PresentableStage
}

const edgeTypes = {
  customEdge: CustomEdge
}

export default function PipelineGraph({nodes, edges} : { nodes: CustomNode[], edges: Edge[] }) {

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
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
  );
}