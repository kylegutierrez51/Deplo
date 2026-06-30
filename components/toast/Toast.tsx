"use client"

import styles from './toast.module.css';

type ToastIcon = 'checkmark-circle-outline' | 'create-outline' | 'trash-outline';

export default function Toast({ text, icon }: { text: string, icon: ToastIcon }) {
  
  return (
    <div className={styles["toast"]}>
      <div className={styles["toast-flex"]}>
        <div className={styles["toast-icon"]}>
          <ion-icon name={icon}></ion-icon>
        </div>
        <p>{text}</p>
      </div>
    </div>
  )
}