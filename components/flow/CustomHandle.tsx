"use client"

import { Handle, useNodeConnections, Position } from '@xyflow/react';

export type CustomHandleProps = {
  type: 'source' | 'target';
  position: Position;
  connectionCount: number;
}

// Since <Handle /> doesn't accept a 'connectionCount' prop, destructure 'connectionCount' before spreading out the props so that it doesn't leak into <Handle />
export default function CustomHandle({ connectionCount, ...props }: CustomHandleProps) {
  const connections = useNodeConnections({
    handleType: props.type,
  });

  return <Handle {...props} isConnectable={connections.length < connectionCount} />;
};