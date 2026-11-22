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
        aria-label="Variable key"
        placeholder="e.g., NODE_ENV"
        spellCheck={false}
        value={envKey}
        onChange={e => onChange('key', e.target.value)}
      />
      <span>=</span>
      <input
        name="env-value"
        aria-label="Variable value"
        placeholder="e.g. production"
        spellCheck={false}
        value={envValue}
        onChange={e => onChange('value', e.target.value)}
      />
      <button type="button" aria-label="Remove variable" className={styles['delete-env-btn']} onClick={onDelete}>
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>
  )
}
