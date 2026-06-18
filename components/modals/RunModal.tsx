"use client"

import Link from 'next/link';
import Modal from './Modal';
import modalStyles from './modal.module.css';
import runHistoryStyles from './run-modal.module.css';
import Pill from '@/components/Pill';
import type { PipelineStatus, EnvType, TriggerType } from '@/lib/data/runs';

const styles = { ...modalStyles, ...runHistoryStyles };

interface RunModalProps {
  mode: 'view' | 'edit' | 'create';
  id?: number;
  status?: PipelineStatus;
  pipeline?: string;
  repo?: string;
  environment?: EnvType;
  trigger?: TriggerType;
  duration?: string;
  time?: string;
  onClose: () => void;
}

export default function RunModal({
  mode = 'view',
  id,
  pipeline,
  repo,
  status,
  environment,
  trigger,
  duration,
  time,
  onClose,
}: RunModalProps) {
  const footer =
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Close</button>
      <Link href={`/runs/${id}`} className={`${styles.footerBtn} ${styles.editBtn}`}>View Full Run</Link>
    </>

  return (
    <Modal title={"Run"} onClose={onClose} footer={footer} mode={mode}>
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
              <span><Pill variant={status} label={status.charAt(0).toUpperCase() + status.slice(1)} /></span>
            </div>
          )}
        </div>

        <div className={styles['item-flex']}>
          {environment && (
            <div className={styles.item}>
              <label>Environment</label>
              <span><Pill variant={environment} label={environment.charAt(0).toUpperCase() + environment.slice(1)} /></span>
            </div>
          )}
          {trigger && (
            <div className={styles.item}>
              <label>Trigger</label>
              <span><Pill variant={trigger} label={trigger === 'api' ? 'API' : trigger.charAt(0).toUpperCase() + trigger.slice(1)} /></span>
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
