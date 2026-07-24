"use client"

import styles from './stage-sidebar.module.css'

interface SecretCheckboxRowProps {
  secretKey: string;
  checked: boolean;
  onToggle: () => void;
}

export default function SecretCheckboxRow({ secretKey, checked, onToggle }: SecretCheckboxRowProps) {
  return (
    <label className={styles['secret-container']}>
      <div className={styles.secret}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className={styles['secret-key']}>{secretKey}</span>
      </div>
    </label>
  )
}