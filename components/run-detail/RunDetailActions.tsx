"use client"

import type { RunStatus } from '@/lib/types';
import { useTransition } from 'react';
import { useToast } from '@/components/ui/toast/ToastContext';
import styles from './run-detail-card.module.css'
import { retryRun, cancelRun } from '@/lib/actions/run-detail';

export default function RunDetailActions({ id, status }: { id: string, status: RunStatus }) {
  const [isCancelling, startCancelTransition] = useTransition();
  const [isRetrying, startRetryTransition] = useTransition();
  const { showToast } = useToast();

  const readyToCancel = () => ['queued', 'running'].includes(status)
  const readyToRetry = () => ['succeeded', 'failed', 'cancelled'].includes(status)



  const handleCancelRun = () => {
    startCancelTransition(async () => {
      if (!readyToCancel()) return;
      const result = await cancelRun(id);

      showToast(
        result.message,
        result.status !== 'success' ? 'close-circle-outline' : 'checkmark-circle-outline',
      );
    });
  }

  const handleRetryRun = () => {
    startRetryTransition(async () => {
      if (!readyToRetry()) return;
      const result = await retryRun(id);
      const failed = result.status !== 'success';

      showToast(
        result.message,
        failed ? 'close-circle-outline' : 'checkmark-circle-outline',
        result.runId ? `/runs/${result.runId}` : undefined,
        { sticky: true },
      );
    });
  }

  const isBusy = isCancelling || isRetrying;

  return (
    <div className={styles['rdc-actions']}>
      {readyToCancel() &&
        <button className={styles['rdc-btn-cancel']} disabled={isBusy} onClick={() => handleCancelRun()}>
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
  )
}