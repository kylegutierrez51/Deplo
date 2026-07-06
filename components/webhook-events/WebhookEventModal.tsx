"use client"

import Modal from '../modals/Modal';
import modalStyles from '../modals/modal.module.css';
import webhookEventStyles from './webhook-event-modal.module.css';
import Pill from '@/components/Pill';
import type { PillVariant } from '@/components/Pill';
import { capitalize, getRepoName, getBranch } from '@/lib/utils/string';
import { formatDate } from '@/lib/utils/date';

const styles = { ...modalStyles, ...webhookEventStyles };

interface WebhookEventModalProps {
  mode?: 'view' | 'create' | 'edit';
  status?: PillVariant;
  eventType?: PillVariant;
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  pipeline?: { name: string; repoUrl: string } | null;
  receivedAt: Date;
  onClose: () => void;
}

export default function WebhookEventModal({
  mode = 'view',
  status,
  eventType,
  branch,
  commitSha,
  commitMessage,
  pipeline,
  receivedAt,
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
            <span>{pipeline ? getRepoName(pipeline.repoUrl) : 'None'}</span>
          </div>
          <div className={styles.item}>
            <label>Branch</label>
            <span>{branch ? getBranch(branch) : 'None'}</span>
          </div>
        </div>

        <div className={styles.item}>
          <label>Commit</label>
          <div className={styles['commit-detail']}>
            <span className={styles['commit-hash']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              {commitSha ?? 'None'}
            </span>
            <span className={styles['commit-message']}>{commitMessage ?? 'None'}</span>
          </div>
        </div>

        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Pipeline</label>
            <span>{pipeline?.name ?? 'None'}</span>
          </div>
          <div className={styles.item}>
            <label>Received</label>
            <span>{formatDate(receivedAt)}</span>
          </div>
        </div>
      </>
    </Modal>
  );
}
