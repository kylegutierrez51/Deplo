"use client"

import styles from '@/components/ui/stage-panel.module.css'
import EnvVarRow from './EnvVarRow'

interface EnvVarsSectionProps {
  vars: Record<string, string>[]
  onAdd: () => void;
  onChange: (index: number, field: 'key' | 'value', value: string) => void;
  onDelete: (index: number) => void;
}

export default function EnvVarsSection({ vars, onAdd, onChange, onDelete }: EnvVarsSectionProps) {
  return (
    <section className={`${styles.section} ${styles['env-vars']}`} aria-labelledby="env-vars-title">
      <div className={styles['env-title-container']}>
        <div className={styles['env-title']}>
          <ion-icon name="settings-outline"></ion-icon>
          <h3 id="env-vars-title" className={styles['section-title']}>Environment variables</h3>
        </div>
        <button className={styles['add-env-btn']} type="button" onClick={onAdd}>
          <ion-icon name="add-outline"></ion-icon>
          Add
        </button>
      </div>
      {!vars.length && <p className={styles.info}>No variables added to this stage.</p>}
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
    </section>
  )
}
