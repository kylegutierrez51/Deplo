"use client"

import styles from './confirmation-modal.module.css';
import { useState, useEffect, useTransition, type ReactNode } from 'react';
import Pill, { PillVariant } from '../Pill';

export type ConfirmVariant = 'danger' | 'success';

interface ConfirmationModalProps {
  message: string;
  subMessage?: ReactNode;
  pill?: { variant: PillVariant; label: string }
  action: string;
  cancelAction?: string;
  variant?: ConfirmVariant;
  handleConfirmation: () => Promise<void>;
  onClose: () => void;
  timeoutMs?: number;
}
export default function ConfirmationModal({ message, subMessage, action, cancelAction='Cancel', pill, variant='danger', handleConfirmation, onClose, timeoutMs }: ConfirmationModalProps) {
  const [ready, setReady] = useState(false);
  const [isBusy, startConfirmTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true)
    }, timeoutMs || 3000)

    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return (
    <div className={styles["confirmation-overlay"]} style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} onClick={!isBusy ? () => onClose() : undefined}>
      <div className={styles["confirmation-container"]} onClick={e => e.stopPropagation()}>
        <p>{message}</p>
        {(subMessage || pill) && (
          <div className={styles["message-meta"]}>
            {subMessage}
            {pill && <Pill variant={pill.variant} label={pill.label}/>}
          </div>
        )}

        <div className={styles['btn-group']}>
          {isBusy ?
            <button className={styles["cancel-ghost-btn"]} type="button" disabled>{cancelAction}</button> :
            <button className={styles["cancel-btn"]} type="button" onClick={() => onClose()}>{cancelAction}</button>
          }
          {!ready || isBusy ? 
            <button className={styles[`confirm-${variant}-ghost`]} type="button" disabled>{action}</button> :
            <button className={styles[`confirm-${variant}`]} type="button" onClick={() => startConfirmTransition(handleConfirmation)}>{action}</button> 
          }
        </div>
      </div>
    </div>
  )
}