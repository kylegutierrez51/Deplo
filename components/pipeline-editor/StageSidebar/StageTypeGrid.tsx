"use client"

import styles from './stage-sidebar.module.css';
import type { CustomNode, StageType } from "@/lib/types";
import { usePipelineGraph } from '../PipelineGraphProvider';

interface StageTypeGridProps {
  selectedType?: StageType;
  setType: (type: StageType) => void;
  node: CustomNode;
}

const STAGE_TYPES = [
  { type: 'custom', label: 'Custom', icon: 'flask-outline' },
  { type: 'deploy', label: 'Deploy', icon: 'rocket-outline' },
  { type: 'approval', label: 'Approval', icon: 'shield-checkmark-outline' },
] as const;

export default function StageTypeGrid({ selectedType, setType, node }: StageTypeGridProps) {
  const { updateNodeData } = usePipelineGraph();

  return (
    <div className={styles['stage-type-grid']}>
      {STAGE_TYPES.map(({ type, label, icon }) => (
        <div
          key={type}
          className={`${styles.item}${selectedType === type ? ` ${styles['selected-type']}` : ''}`}
          onClick={() => {
            setType(type);
            updateNodeData(node.id, { type: type });
          }}
        >
          <ion-icon name={icon}></ion-icon>
          <div>{label}</div>
        </div>
      ))}
    </div>
  )
}
