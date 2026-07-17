"use client"

import styles from './stage-sidebar.module.css'
import type { StageType } from './StageConfigForm';

interface StageTypeGridProps {
  selected?: StageType;
  onSelect: (type: StageType) => void;
}

const STAGE_TYPES = [
  { type: 'custom', label: 'Custom', icon: 'flask-outline' },
  { type: 'deploy', label: 'Deploy', icon: 'rocket-outline' },
  { type: 'approval', label: 'Approval', icon: 'shield-checkmark-outline' },
] as const;

export default function StageTypeGrid({ selected, onSelect }: StageTypeGridProps) {
  return (
    <div className={styles['stage-type-grid']}>
      {STAGE_TYPES.map(({ type, label, icon }) => (
        <div
          key={type}
          className={`${styles.item}${selected === type ? ` ${styles.selected}` : ''}`}
          onClick={() => onSelect(type)}
        >
          <ion-icon name={icon}></ion-icon>
          <div>{label}</div>
        </div>
      ))}
    </div>
  )
}
