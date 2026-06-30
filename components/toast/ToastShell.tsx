"use client"

import styles from './toast.module.css';
import Toast from './Toast';
import { useToast } from './ToastContext';

export default function ToastShell() {
  const toast = useToast();

  return (
    <div className={styles["toast-container"]}>
      {toast.toast &&
        <Toast text={toast.toast.text} icon={toast.toast.icon} />  
      }
    </div>
  )
}


