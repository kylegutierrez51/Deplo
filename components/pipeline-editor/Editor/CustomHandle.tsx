"use client"

import { Handle, useNodeConnections, Position } from '@xyflow/react';

export type CustomHandleProps = {
  type: 'source' | 'target';
  position: Position;
  connectionCount: number;
}

export default function CustomHandle(props: CustomHandleProps) {
  const connections = useNodeConnections({
    handleType: props.type,
  });
 
  return <Handle {...props} isConnectable={connections.length < props.connectionCount} />;
};