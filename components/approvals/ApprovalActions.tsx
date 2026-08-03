"use client"

import Link from 'next/link';
import styles from './approval.module.css'


// add OnApprove and OnReject: () => void;
interface ApprovalActionsProps {
  runId: string
}

export default function ApprovalActions({ runId }: ApprovalActionsProps) {
  return (
    <div className={styles['btn-group']}>
      <Link href={`/runs/${runId}`} target="_blank" className={styles['view-run-btn']}>
        <ion-icon name="open-outline"></ion-icon>
        View Run
      </Link>
      <button className={styles['reject-btn']}>
        <ion-icon name="close-circle-outline"></ion-icon>
        Reject
      </button>
      <button className={styles['approve-btn']}>
        <ion-icon name="checkmark-circle-outline"></ion-icon>
        Approve
      </button>
    </div>
  )
}

