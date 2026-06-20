"use client"

import styles from './stage-sidebar.module.css'

interface EnvVarRowProps {
  envKey: string;
  envValue: string;
  onChange: (field: 'key' | 'value', value: string) => void;
  onDelete: () => void;
}

export default function EnvVarRow({ envKey, envValue, onChange, onDelete }: EnvVarRowProps) {
  return (
    <div className={styles['env-container']}>
      <input
        name="env-key"
        placeholder="KEY"
        value={envKey}
        onChange={e => onChange('key', e.target.value)}
      />
      <span>=</span>
      <input
        name="env-value"
        placeholder="VALUE"
        value={envValue}
        onChange={e => onChange('value', e.target.value)}
      />
      <button onClick={onDelete}>
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  )
}
