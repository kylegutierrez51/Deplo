"use client"

import styles from './header-buttons.module.css'

export default function HeaderButtons() {
  return (
    <div className={styles['right-side']}>
      <button className={styles['save-btn']}>
        <ion-icon name="save-outline"></ion-icon>
        Save
      </button>
      <button className={styles['run-btn']}>
        <ion-icon name="caret-forward-outline"></ion-icon>
        Run Pipeline
      </button>
    </div>
  )
}