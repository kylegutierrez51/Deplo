"use client"

import Link from 'next/link';
import styles from './approval.module.css';
import ConfirmationModal from '@/components/ui/modals/ConfirmationModal';
import { approveOrRejectStage } from '@/lib/actions/approvals';
import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/toast/ToastContext';
import { capitalize } from '@/lib/utils/string';
import type { EnvType } from '@/lib/types';

interface ApprovalActionsProps {
  id: string;
  runId: string;
  stageId: string;
  env: { type: EnvType; name: string; } | null
}

export default function ApprovalActions({ id, runId, stageId, env }: ApprovalActionsProps) {
  const [isBusy, startApproveOrRejectTransition] = useTransition();
  const [approvalModal, setApprovalModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const { showToast } = useToast();

  const approveOrReject = async (approved: boolean) => {    
    startApproveOrRejectTransition(async () => {
      const result = await approveOrRejectStage(id, runId, stageId, approved);
      showToast(result.message, result.status === 'success' ? 'checkmark-circle-outline' : 'close-circle-outline');
    });
    if (approved) setApprovalModal(false);
    else setRejectModal(false);
  }


  return (
    <>
      <div className={styles['btn-group']}>
        <Link href={`/runs/${runId}`} target="_blank" className={styles['view-run-btn']}>
          <ion-icon name="open-outline"></ion-icon>
          View Run
        </Link>
        <button className={styles['reject-btn']} onClick={() => setRejectModal(true)} disabled={isBusy} type="button">
          <ion-icon name="close-circle-outline"></ion-icon>
          Reject
        </button>
        <button className={styles['approve-btn']} onClick={() => setApprovalModal(true)} disabled={isBusy} type="button">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          Approve
        </button>
      </div>

      {approvalModal && !rejectModal &&
        <ConfirmationModal
          message={'Approve this stage?'}
          subMessage={env ? <><span className={styles['meta-label']}>Environment:</span>{env.name}</> : undefined}
          pill={env ? { variant: env.type, label: capitalize(env.type) } : undefined}
          action={"Approve"}
          cancelAction={"Back"}
          variant="success"
          handleConfirmation={() => approveOrReject(true)}
          onClose={() => setApprovalModal(false)}
          timeoutMs={env?.type === 'production' ? 5000 : 1500} />
      }

      {rejectModal && !approvalModal &&
        <ConfirmationModal
          message={'Reject this stage?'}
          subMessage={env ? <><span className={styles['meta-label']}>Environment:</span>{env.name}</> : undefined}
          pill={env ? { variant: env.type, label: capitalize(env.type) } : undefined}
          action={"Reject"}
          cancelAction={"Back"}
          variant="danger"
          handleConfirmation={() => approveOrReject(false)}
          onClose={() => setRejectModal(false)}
          timeoutMs={env?.type === 'production' ? 5000 : 1500} />
      }
    </>

  )
}

