"use client"

import styles from './toast.module.css';
import Toast from './Toast';
import { useToast } from './ToastContext';

export default function ToastShell() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className={styles["toast-container"]}>
      {toasts.map(t => (
        <Toast
          key={t.id}
          text={t.text}
          icon={t.icon}
          link={t.link}
          exiting={t.exiting}
          sticky={t.sticky}
          onDismiss={() => dismissToast(t.id)}
        />
      ))}
    </div>
  )
}


