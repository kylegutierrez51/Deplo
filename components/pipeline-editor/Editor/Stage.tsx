"use client"

import styles from './stage.module.css'
import type { Node, NodeProps } from '@xyflow/react';

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
    </div>
  );
}