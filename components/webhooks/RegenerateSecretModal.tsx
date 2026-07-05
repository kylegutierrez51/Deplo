"use client"

import styles from '../modals/delete-confirmation.module.css';
import { useTransition, useState, useEffect } from 'react';
import { regenerateWebhookSecret } from '@/lib/actions/webhooks';

interface RegenerateSecretModalProps {
  id: string;
  onRegenerate: (secret: string) => void;
  onRegenerateClose: () => void;
  onError: (message: string) => void;
}

export default function RegenerateSecretModal({ id, onRegenerate, onRegenerateClose, onError }: RegenerateSecretModalProps) {
  const [_isRegeneratePending, startRegenerateTransition] = useTransition();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true)
    }, 3000)

    return () => clearTimeout(timer);
  }, [])

  const handleRegenerate = () => startRegenerateTransition(async () => {
    const result = await regenerateWebhookSecret(id);
    if (result.status === 'success' && result.secret) {
      onRegenerate(result.secret);
    }
    else if (result.status === 'error') {
      onError(result.message);
    }
  });

  return (
    <div className={styles["delete-overlay"]} style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} onClick={onRegenerateClose}>
      <div className={styles["delete-container"]} onClick={e => e.stopPropagation()}>
        <p>Regenerate this webhook&apos;s secret? The current secret will stop validating deliveries immediately.</p>
        <div className={styles['btn-group']}>
          <button className={styles["cancel-btn"]} type="button" onClick={onRegenerateClose}>Cancel</button>
          {!ready ?
            <button className={styles["delete-ghost-btn"]} type="button">Regenerate</button> :
            <button className={styles["delete-btn"]} type="button" onClick={handleRegenerate}>Regenerate</button>
          }
        </div>
      </div>
    </div>
  )
}
