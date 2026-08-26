"use client"

import styles from './toast.module.css';
import { type ToastIcon } from '@/lib/types';
import Link from 'next/link';

interface ToastProps {
  text: string;
  icon: ToastIcon;
  link?: string;
  exiting: boolean;
  sticky: boolean;
  onDismiss: () => void;
}

export default function Toast({ text, icon, link, exiting, sticky, onDismiss }: ToastProps) {
  return (
    <div className={`${styles["toast-flex"]}${sticky ? ` ${styles.sticky}` : ''}${exiting ? ` ${styles.exiting}` : ''}`}>
      <div className={styles["toast-icon"]}>
        <ion-icon name={icon}></ion-icon>
      </div>
      {/* pre-line so a multi-line report keeps the line breaks the action wrote */}
      <p className={styles["toast-text"]}>{text}</p>
      {link && 
        <Link href={link} target="_blank" className={styles['link-icon']}>
          <ion-icon name="open-outline"></ion-icon>
        </Link>
      }
      {sticky &&
        <button className={styles["toast-dismiss"]} type="button" onClick={onDismiss} aria-label="Dismiss">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      }
    </div>
  )
}
