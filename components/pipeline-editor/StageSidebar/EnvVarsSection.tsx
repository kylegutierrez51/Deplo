"use client"

import styles from './stage-sidebar.module.css'
import EnvVarRow from './EnvVarRow'

interface EnvVarsSectionProps {
  vars: { key: string; value: string }[];
  onAdd: () => void;
  onChange: (index: number, field: 'key' | 'value', value: string) => void;
  onDelete: (index: number) => void;
}

export default function EnvVarsSection({ vars, onAdd, onChange, onDelete }: EnvVarsSectionProps) {
  return (
    <div className={styles['env-vars']}>
      <div className={styles['env-title-container']}>
        <div className={styles['env-title']}>
          <ion-icon name="settings-outline"></ion-icon>
          <label>ENV VARIABLES</label>
        </div>
        <button className={styles['add-env-btn']} type="button" onClick={onAdd}>
          <ion-icon name="add-outline"></ion-icon>
          Add
        </button>
      </div>
      <div className={styles['env-vars-list']}>
        {vars.map((v, i) => (
          <EnvVarRow
            key={i}
            envKey={v.key}
            envValue={v.value}
            onChange={(field, value) => onChange(i, field, value)}
            onDelete={() => onDelete(i)}
          />
        ))}
      </div>
    </div>
  )
}
