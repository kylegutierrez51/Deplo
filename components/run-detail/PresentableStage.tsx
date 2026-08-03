"use client"

import styles from './presentable-stage.module.css'
import { type Node, type NodeProps, Position } from '@xyflow/react';
import CustomHandle from '@/components/flow/CustomHandle';
import { JobStatus } from '@/lib/data/run-detail';
import Pill from '@/components/ui/Pill';
import { capitalize } from '@/lib/utils/string';

type PresentableStage = Node<
  {
    type: 'custom' | 'deploy' | 'approval';
    name?: string;
    label?: string;
    status?: JobStatus;
    duration?: string;
  }>;

export default function PresentableStage(props: NodeProps<PresentableStage>) {
  return (
    <div className={styles['stage-container']}>
      <div className={styles['stage-header']}>
        <div className={styles['stage-header-left']}>
          {props.data.type &&
            <div className={`${styles['icon-container']} ${styles[props.data.type]}`}>
              <ion-icon name={
                props.data.type === 'custom' ? 'flask-outline' : props.data.type === 'deploy' ? 'rocket-outline' : 'shield-checkmark-outline'}>
              </ion-icon>
            </div>
          }
          {props.data.name ? <p className={styles['stage-name']} title={props.data.name}>{props.data.name}</p> :
            <p className={styles['stage-name']}>New Stage</p>
          }
        </div>
        {props.data.duration && <p className={styles['stage-duration']}>{props.data.duration}</p>}
      </div>

      <div className={styles['stage-detail']}>
        <div className={styles['stage-detail-left']}>
          {props.data.label && <div className={styles['stage-label']} title={props.data.label}><p>{props.data.label}</p></div>}
          {props.data.status && <Pill variant={props.data.status} label={props.data.status === 'awaiting-approval' ? capitalize('awaiting') : capitalize(props.data.status)} />}
        </div>
      </div>

      <CustomHandle type="target" position={Position.Top} connectionCount={100} />
      <CustomHandle type="source" position={Position.Bottom} connectionCount={100} />
    </div>
  );
}