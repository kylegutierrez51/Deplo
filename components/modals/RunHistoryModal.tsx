"use client"

import Link from 'next/link';
import Modal from './Modal';
import modalStyles from './modal.module.css';
import runHistoryStyles from './run-history-modal.module.css';
import Pill from '@/components/Pill';
import type { PillVariant } from '@/components/Pill';

const styles = { ...modalStyles, ...runHistoryStyles };

interface RunHistoryModalProps {
  initialMode?: 'view';
  runId?: string | number;
  pipeline?: string;
  repo?: string;
  status?: PillVariant;
  statusLabel?: string;
  environment?: PillVariant;
  environmentLabel?: string;
  trigger?: PillVariant;
  triggerLabel?: string;
  duration?: string;
  time?: string;
  onClose: () => void;
}

export default function RunHistoryModal({
  initialMode = 'view',
  runId,
  pipeline,
  repo,
  status,
  statusLabel,
  environment,
  environmentLabel,
  trigger,
  triggerLabel,
  duration,
  time,
  onClose,
}: RunHistoryModalProps) {
  const footer =
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Close</button>
      <Link href={`/runs/${runId}`} className={`${styles.footerBtn} ${styles.editBtn}`}>View Full Run</Link>
    </>

  return (
    <Modal title={"Run"} onClose={onClose} footer={footer} mode={initialMode}>
      <>
        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Pipeline</label>
            <div className={styles['pipeline-detail']}>
              <span>{pipeline}</span>
              <span className={styles.repo}>{repo}</span>
            </div>
          </div>
          {status && (
            <div className={styles.item}>
              <label>Status</label>
              <span><Pill variant={status} label={statusLabel ?? status} /></span>
            </div>
          )}
        </div>

        <div className={styles['item-flex']}>
          {environment && (
            <div className={styles.item}>
              <label>Environment</label>
              <span><Pill variant={environment} label={environmentLabel ?? environment} /></span>
            </div>
          )}
          {trigger && (
            <div className={styles.item}>
              <label>Trigger</label>
              <span><Pill variant={trigger} label={triggerLabel ?? trigger} /></span>
            </div>
          )}
        </div>

        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Duration</label>
            <span className={styles.duration}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              {duration}
            </span>
          </div>
          <div className={styles.item}>
            <label>Time</label>
            <span>{time}</span>
          </div>
        </div>
      </>
    </Modal>
  );
}
