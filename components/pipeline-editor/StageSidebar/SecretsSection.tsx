"use client"

import styles from './stage-sidebar.module.css';
import SecretCheckboxRow from './SecretCheckboxRow';

interface SecretsSectionProps {
  secrets: { id: string; key: string; checked: boolean }[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onToggle: (id: string) => void;
  hasEnvironment: boolean;
}

export default function SecretsSection({ secrets, searchValue, onSearchChange, onToggle, hasEnvironment }: SecretsSectionProps) {
  const visible = secrets
    .filter(s => !searchValue || s.key.toLowerCase().includes(searchValue.toLowerCase())); // keep everything in secrets if searchValue is empty or only secrets whose key contains searchValue (case-insensitive)

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
        {hasEnvironment ? (
          visible.map(({ id, key, checked }) => (
            <SecretCheckboxRow
              key={id}
              secretKey={key}
              checked={checked}
              onToggle={() => onToggle(id)}
            />
          ))
        ) : (
          <div className={styles.info}>Select an environment to see its secrets.</div>
        )}
      </div>
    </>
  )
}
