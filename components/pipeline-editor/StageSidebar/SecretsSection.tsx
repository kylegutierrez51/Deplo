"use client"

import styles from './stage-sidebar.module.css'
import SecretCheckboxRow from './SecretCheckboxRow'

interface SecretsSectionProps {
  secrets: { key: string; env: string; checked: boolean }[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onToggle: (index: number) => void;
}

export default function SecretsSection({ secrets, searchValue, onSearchChange, onToggle }: SecretsSectionProps) {
  const visible = secrets
    .map((s, i) => ({ ...s, originalIndex: i }))
    .filter(s => !searchValue || s.key.toLowerCase().includes(searchValue.toLowerCase()));

  return (
    <>
      <div className={styles.secrets}>
        <div className={styles['secrets-info']}>
          <div>
            <ion-icon name="lock-closed-outline"></ion-icon>
            <label>SECRETS</label>
          </div>
          <div className={styles.info}>Injected at runtime. Never logged.</div>
        </div>
        <input
          id="secret"
          name="secret"
          placeholder="e.g. DATABASE_URL"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className={styles['secrets-list']}>
        {visible.map(({ originalIndex, key, env, checked }) => (
          <SecretCheckboxRow
            key={originalIndex}
            secretKey={key}
            env={env}
            checked={checked}
            onToggle={() => onToggle(originalIndex)}
          />
        ))}
      </div>
    </>
  )
}
