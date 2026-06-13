"use client"

import styles from './sidebar.module.css';
import Link from 'next/link';

interface TopbarProps {
  activeItem: string | undefined;
  showToggle: boolean;
  handleToggle: (() => void) | undefined;
}

export default function Topbar({ activeItem, showToggle, handleToggle }: TopbarProps) {
  return (
    <>
      {activeItem === 'run-detail' ? (
        <div className={styles.topbar}>
          <button className={styles["sidebar-toggle"]} id="sidebarToggle" onClick={handleToggle}>
            <ion-icon name="menu-outline"></ion-icon>
          </button>

          <Link href="/runs" className={styles['back-link']}>
            <ion-icon name="arrow-back-outline"></ion-icon>
            Run History
          </Link>
        </div>
      ) : showToggle && (
        <button className={styles["sidebar-toggle"]} id="sidebarToggle" onClick={handleToggle}>
          <ion-icon name="menu-outline"></ion-icon>
        </button>
      )}
    </>
  )
}
