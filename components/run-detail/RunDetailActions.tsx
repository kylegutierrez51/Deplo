"use client"

import type { RunStatus, EnvType } from '@/lib/types';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/toast/ToastContext';
import styles from './run-detail-card.module.css'
import ConfirmationModal from '@/components/ui/modals/ConfirmationModal';
import { retryRun, cancelRun } from '@/lib/actions/run-detail';
import { capitalize } from '@/lib/utils/string';

interface RunDetailActionsProps {
  id: string;
  status: RunStatus;
  env: { type: EnvType; name: string; } | null
}

export default function RunDetailActions({ id, status, env }: RunDetailActionsProps) {
  const [isCancelling, startCancelTransition] = useTransition();
  const [isRetrying, startRetryTransition] = useTransition();
  const [cancelModal, setCancelModal] = useState(false);
  const { showToast } = useToast();

  const readyToCancel = () => ['queued', 'running'].includes(status);
  const readyToRetry = () => ['succeeded', 'failed', 'cancelled'].includes(status);

  const handleCancelRun = async () => {
    startCancelTransition(async () => {
      const result = await cancelRun(id);

      showToast({
        text: result.message,
        icon: result.status !== 'success' ? 'close-circle-outline' : 'checkmark-circle-outline',
      });
      setCancelModal(false);
    });
  }

  const handleRetryRun = async () => {
    startRetryTransition(async () => {
      if (!readyToRetry()) return;
      const result = await retryRun(id);
      const failed = result.status !== 'success';

      showToast({
        text: result.message,
        icon: failed ? 'close-circle-outline' : 'checkmark-circle-outline',
        link: result.runId ? `/runs/${result.runId}` : undefined,
        options: { sticky: true },
      });
    });
  }

  const isBusy = isCancelling || isRetrying;

  return (
    <>
      <div className={styles['rdc-actions']}>
        {readyToCancel() &&
          <button className={styles['rdc-btn-cancel']} disabled={isBusy} onClick={() => setCancelModal(true)}>
            <ion-icon name="ban-outline"></ion-icon>
            Cancel Run
          </button>
        }

        {readyToRetry() &&
          <button className={styles['rdc-btn-rerun']} disabled={isBusy} onClick={() => handleRetryRun()}>
            <ion-icon name="refresh-outline"></ion-icon>
            Re-run
          </button>
        }
      </div>

      {cancelModal &&
        <ConfirmationModal 
          message={'Cancel this run?'} 
          subMessage={env ? <><span className={styles['meta-label']}>Environment:</span>{env.name}</> : undefined}
          pill={env ? {variant: env.type, label: capitalize(env.type)} : undefined} 
          action={"Cancel"}
          cancelAction={"Back"} 
          handleConfirmation={handleCancelRun} 
          onClose={() => setCancelModal(false)} 
          timeoutMs={1500} />
      }
    </>

  )
}

