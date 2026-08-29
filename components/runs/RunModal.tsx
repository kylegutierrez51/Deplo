"use client"

import Link from 'next/link';
import Modal from '@/components/ui/modals/Modal';
import modalStyles from '@/components/ui/modals/modal.module.css';
import runHistoryStyles from './run-modal.module.css';
import Pill from '@/components/ui/Pill';
import type { RunStatus, RunTrigger } from '@/lib/types';
import type { Run } from '@/lib/data/runs';
import { capitalize } from "@/lib/utils/string";
import { formatDate, getDuration } from "@/lib/utils/date";

const styles = { ...modalStyles, ...runHistoryStyles };

interface RunModalProps {
  mode: 'view' | 'edit' | 'create';
  id: string;
  status: RunStatus;
  pipelineName: Run['pipelineName'];
  runNumber: number;
  repoUrl: string | null;
  environment: Run['environment'];
  trigger: RunTrigger;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  onClose: () => void;
}

export default function RunModal({
  mode = 'view',
  id,
  status,
  pipelineName,
  runNumber,
  repoUrl,
  environment,
  trigger,
  startedAt,
  finishedAt,
  createdAt,
  onClose,
}: RunModalProps) {

  const duration = startedAt && finishedAt ? getDuration(startedAt, finishedAt) : startedAt ? 'Ongoing' : '—';

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
              <span className={styles['pipeline']}>{pipelineName} <span className={styles['run-number']}>#{runNumber}</span></span>
              {repoUrl && <span className={styles.repo}>{repoUrl}</span>}
            </div>
          </div>
          {status && (
            <div className={styles.item}>
              <label>Status</label>
              <span><Pill variant={status} label={capitalize(status)} /></span>
            </div>
          )}
        </div>

        <div className={styles['item-flex']}>
            <div className={styles.item}>
              <label>Environment</label>
              <span>{environment ? 
                <>
                  {environment.name} <Pill variant={environment.type} label={capitalize(environment.type)} /> 
                </> : 'None'}</span>
            </div>
          {trigger && (
            <div className={styles.item}>
              <label>Trigger</label>
              <span><Pill variant={trigger} label={trigger === 'api' ? 'API' : capitalize(trigger)} /></span>
            </div>
          )}
        </div>

        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Created At</label>
            <span>{formatDate(createdAt)}</span>
          </div>
          <div className={styles.item}>
            <label>Duration</label>
            <span className={styles.duration}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              {duration}
            </span>
          </div>
          <div className={styles.item}>
            <label>Start Time</label>
            <span>{startedAt ? formatDate(startedAt) : '—'}</span>
          </div>
        </div>
      </>
    </Modal>
  );
}
