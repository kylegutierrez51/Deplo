"use client"

import styles from './run-detail-actions.module.css'

/*
onCancel: () => void; 
onRerun: () => void
*/
export default function RunDetailActions() {
  return (
    <div className={styles['rdc-actions']}>
      <button className={styles['rdc-btn-cancel']}>
        <ion-icon name="ban-outline"></ion-icon>
        Cancel Run
      </button>
      <button className={styles['rdc-btn-rerun']}>
        <ion-icon name="refresh-outline"></ion-icon>
        Re-run
      </button>
    </div>
  )
}