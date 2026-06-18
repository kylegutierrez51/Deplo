"use client"

import Modal from './Modal';
import modalStyles from './modal.module.css';
import webhookEventStyles from './webhook-event-modal.module.css';
import Pill from '@/components/Pill';
import type { PillVariant } from '@/components/Pill';
import { capitalize } from '@/lib/utils/string';

const styles = { ...modalStyles, ...webhookEventStyles };

interface WebhookEventModalProps {
  mode?: 'view' | 'create' | 'edit';
  status?: PillVariant;
  eventType?: PillVariant;
  repository?: string;
  branch?: string;
  commitHash?: string;
  commitMessage?: string;
  pipeline?: string;
  received?: string;
  onClose: () => void;
}

export default function WebhookEventModal({
  mode = 'view',
  status,
  eventType,
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
    <Modal title={"Webhook Event"} onClose={onClose} footer={footer} mode={mode}>
      <>
        <div className={styles['item-flex']}>
          {status && (
            <div className={styles.item}>
              <label>Status</label>
              <span><Pill variant={status} label={capitalize(status)} /></span>
            </div>
          )}
          {eventType && (
            <div className={styles.item}>
              <label>Event</label>
              <span><Pill variant={eventType} label={eventType === 'pull-request' ? 'Pull Request' : capitalize(eventType)} /></span>
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
