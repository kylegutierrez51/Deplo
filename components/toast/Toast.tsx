"use client"

import styles from './toast.module.css';

type ToastIcon = 'checkmark-circle-outline' | 'create-outline' | 'trash-outline';

export default function Toast({ text, icon, exiting }: { text: string, icon: ToastIcon, exiting: boolean }) {
  return (
    <div className={`${styles["toast-flex"]}${exiting ? ` ${styles.exiting}` : ''}`}>
      <div className={styles["toast-icon"]}>
        <ion-icon name={icon}></ion-icon>
      </div>
      <p>{text}</p>
    </div>
  )
}