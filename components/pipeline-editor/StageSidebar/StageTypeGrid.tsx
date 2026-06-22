"use client"

import styles from './stage-sidebar.module.css'

interface StageTypeGridProps {
  selected?: string;
  onSelect: (type: string) => void;
}

const STAGE_TYPES = [
  { type: 'build', label: 'Build', icon: 'hammer-outline' },
  { type: 'test', label: 'Test', icon: 'flask-outline' },
  { type: 'deploy', label: 'Deploy', icon: 'rocket-outline' },
  { type: 'approval', label: 'Approval', icon: 'shield-checkmark-outline' },
  { type: 'script', label: 'Script', icon: 'code-outline' },
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
