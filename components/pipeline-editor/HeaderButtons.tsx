"use client"

import styles from './header-buttons.module.css'

/*
onAddStage: () => void;
onSaveDraft: () => void;
onRunPipeline: () => void;
*/

export default function HeaderButtons() {
  return (
    <div className={styles['right-side']}>
      <button className={styles['add-stage-btn']}>
        <ion-icon name="add-outline"></ion-icon>
        Add Stage
      </button>
      <div className={styles.divider}></div>
      <div className={styles['sidebar-icon']}>
        <ion-icon name="journal-outline"></ion-icon>
      </div>
      <div className={styles.divider}></div>
      <button className={styles['save-btn']}>
        <ion-icon name="save-outline"></ion-icon>
        Save Draft
      </button>
      <button className={styles['run-btn']}>
        <ion-icon name="caret-forward-outline"></ion-icon>
        Run Pipeline
      </button>
    </div>
  )
}