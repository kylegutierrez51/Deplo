"use client";

import { useId, useState } from 'react';
import styles from '@/components/ui/modals/resource-modal.module.css';

export default function CopyField({ label, value }: { label: string, value: string }) {
  const id = useId();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.item}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWithActions}>
        <input
          id={id}
          type="text"
          value={value}
          readOnly
          className={styles.copyInput}
        />
        <div className={styles.inputActions}>
          <button type="button" className={styles.iconActionBtn} aria-label={`Copy ${label}`} onClick={handleCopy}>
            <ion-icon name={copied ? 'checkmark-outline' : 'copy-outline'}></ion-icon>
          </button>
        </div>
      </div>
    </div>
  );
}
