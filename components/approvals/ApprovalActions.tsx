"use client"

import Link from 'next/link';
import styles from './approval.module.css'
import { approveOrRejectStage } from '@/lib/actions/approvals';
import { useTransition } from 'react';
import { useToast } from '@/components/ui/toast/ToastContext';

interface ApprovalActionsProps {
  id: string;
  runId: string;
  stageId: string;
}

export default function ApprovalActions({ id, runId, stageId }: ApprovalActionsProps) {
  const [isBusy, startApproveOrRejectTransition] = useTransition();
  const { showToast } = useToast();

  const approveOrReject = (approved: boolean) => startApproveOrRejectTransition(async () => {
    const result = await approveOrRejectStage(id, runId, stageId, approved);
    showToast(result.message, result.status === 'success' ? 'checkmark-circle-outline' : 'close-circle-outline');
  });


  return (
    <div className={styles['btn-group']}>
      <Link href={`/runs/${runId}`} target="_blank" className={styles['view-run-btn']}>
        <ion-icon name="open-outline"></ion-icon>
        View Run
      </Link>
      <button className={styles['reject-btn']} onClick={() => approveOrReject(false)} disabled={isBusy} type="button">
        <ion-icon name="close-circle-outline"></ion-icon>
        Reject
      </button>
      <button className={styles['approve-btn']} onClick={() => approveOrReject(true)} disabled={isBusy} type="button">
        <ion-icon name="checkmark-circle-outline"></ion-icon>
        Approve
      </button>
    </div>
  )
}

