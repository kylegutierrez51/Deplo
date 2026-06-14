"use client"

import Modal from './Modal';
import modalStyles from './modal.module.css';
import webhookEventStyles from './webhook-event-modal.module.css';
import Pill from '@/components/Pill';
import type { PillVariant } from '@/components/Pill';

const styles = { ...modalStyles, ...webhookEventStyles };

interface WebhookEventModalProps {
  initialMode?: 'view';
  status?: PillVariant;
  statusLabel?: string;
  eventType?: PillVariant;
  eventLabel?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  commitMessage?: string;
  pipeline?: string;
  received?: string;
  onClose: () => void;
}

export default function WebhookEventModal({
  initialMode = 'view',
  status,
  statusLabel,
  eventType,
  eventLabel,
  repository,
  branch,
  commitHash,
  commitMessage,
  pipeline,
  received,
  onClose,
}: WebhookEventModalProps) {
  const footer =
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Close</button>
    </>

  return (
    <Modal title={"Webhook Event"} onClose={onClose} footer={footer} mode={initialMode}>
      <>
        <div className={styles['item-flex']}>
          {status && (
            <div className={styles.item}>
              <label>Status</label>
              <span><Pill variant={status} label={statusLabel ?? status} /></span>
            </div>
          )}
          {eventType && (
            <div className={styles.item}>
              <label>Event</label>
              <span><Pill variant={eventType} label={eventLabel ?? eventType} /></span>
            </div>
          )}
        </div>

        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Repository</label>
            <span>{repository}</span>
          </div>
          <div className={styles.item}>
            <label>Branch</label>
            <span>{branch}</span>
          </div>
        </div>

        <div className={styles.item}>
          <label>Commit</label>
          <div className={styles['commit-detail']}>
            <span className={styles['commit-hash']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              {commitHash}
            </span>
            <span className={styles['commit-message']}>{commitMessage}</span>
          </div>
        </div>

        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Pipeline</label>
            <span>{pipeline}</span>
          </div>
          <div className={styles.item}>
            <label>Received</label>
            <span>{received}</span>
          </div>
        </div>
      </>
    </Modal>
  );
}
