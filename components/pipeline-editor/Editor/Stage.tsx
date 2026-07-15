"use client"

import styles from './editor.module.css'
import { type Node, type NodeProps, Position } from '@xyflow/react';
import CustomHandle from './CustomHandle';

export type StageNode = Node<
  {
    name?: string;
    label?: string;
    timeout?: number;
    retries?: number;
  }
>
export default function Stage(props: NodeProps<StageNode>) {
  return (
    <div className={styles['stage-container']}>
      {props.data.name ? <p className={styles['stage-name']} title={props.data.name}>{props.data.name}</p> :
      <p className={styles['stage-name']}>New Stage</p>
      }
      <div className={styles['stage-detail']}>
        {props.data.label && <div className={styles['stage-label']} title={props.data.label}><p>{props.data.label}</p></div>}
        <div className={styles['stage-options']}>
          {props.data.timeout &&
            <div className={styles['stage-timeout']}>
              <ion-icon name="time-outline"></ion-icon>
              <p>{props.data.timeout}s</p>
            </div>
          }
          {props.data.retries &&
            <div className={styles['stage-retries']}>
              <ion-icon name="refresh-outline"></ion-icon>
              <p>{props.data.retries}</p>
            </div>
          }
        </div>
      </div>
      <CustomHandle type="target" position={Position.Top} connectionCount={100}/>
      <CustomHandle type="source" position={Position.Bottom} connectionCount={100} />
    </div>
  );
}