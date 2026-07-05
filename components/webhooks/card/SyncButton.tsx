"use client"

import styles from './webhook-card.module.css'
import { useState } from 'react';

export default function SyncButton({ id }: { id: string }) {
  const [animate, setAnimate] = useState(false);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnimate((animate) => !animate);
    console.log(id);
  };

  return (
    <button className={`${styles['sync-btn']} ${animate ? ` ${styles['animate']}` : ''}`} onClick={onClick}>
      <ion-icon name="sync-outline"></ion-icon>
    </button>
  )
}