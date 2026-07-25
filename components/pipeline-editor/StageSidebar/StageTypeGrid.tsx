"use client"

import styles from './stage-sidebar.module.css';
import type { CustomNode, StageType } from "@/lib/types";
import { usePipelineGraph } from '../PipelineGraphProvider';
import { capitalize } from '@/lib/utils/string';

interface StageTypeGridProps {
  selectedType?: StageType;
  setType: (type: StageType) => void;
  node: CustomNode;
  label: string;
}

const STAGE_TYPES = [
  { type: 'custom', label: 'Custom', icon: 'flask-outline' },
  { type: 'deploy', label: 'Deploy', icon: 'rocket-outline' },
  { type: 'approval', label: 'Approval', icon: 'shield-checkmark-outline' },
] as const;

export default function StageTypeGrid({ selectedType, setType, node, label }: StageTypeGridProps) {
  const { updateNodeData } = usePipelineGraph();

  const onToggleType = (type: 'custom' | 'deploy' | 'approval') => {
    setType(type);
    updateNodeData(node.id, { type: type, label: type !== 'custom' ? capitalize(type) : label})
  }

  return (
    <div className={styles['stage-type-grid']}>
      {STAGE_TYPES.map(({ type, label, icon }) => (
        <div
          key={type}
          className={`${styles.item}${selectedType === type ? ` ${styles['selected-type']}` : ''}`}
          onClick={() => onToggleType(type)}
        >
          <ion-icon name={icon}></ion-icon>
          <div>{label}</div>
        </div>
      ))}
    </div>
  )
}
