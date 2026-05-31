"use client"

import Link from 'next/link';
import styles from './sidebar.module.css'
import { useState } from 'react';

type ActiveItem = 'pipelines' | 'run-history' | 'run-detail' | 'approvals' | 'secrets' | 'environments' | 'webhooks' | 'audit';

interface SidebarProps {
  activeItem?: ActiveItem;
  showToggle?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ activeItem, showToggle = true, open, onToggle }: SidebarProps) {
  const activePage = (item: ActiveItem) => activeItem === item ? styles['nav-item-activePage'] : undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleToggle = isControlled ? onToggle : () => setInternalOpen(o => !o);

  return (
    <>
      <aside className={`${styles.sidebar} ${!isOpen ? ` ${styles.closed}` : ''}`}>

        <nav className={styles['sidebar-nav']} aria-label="Main">
          <div className={styles['sidebar-content']}>
            <span className={styles.subtitle}>DEPLOY</span>
            <ul>
              <li className={activePage('pipelines')}>
                <Link href="/pipelines">
                  <ion-icon name="git-network-outline"></ion-icon>
                  <span className={styles.title}>Pipelines</span>
                </Link>
              </li>
              <li className={activePage('run-history') || activePage('run-detail')}>
                <Link href="/runs">
                  <ion-icon name="time-outline"></ion-icon>
                  <span className={styles.title}>Run History</span>
                </Link>
              </li>
              <li className={activePage('approvals')}>
                <Link href="/approvals">
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                  <span className={styles.title}>Approvals</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles['sidebar-content']}>
            <span className={styles.subtitle}>MANAGE</span>
            <ul>
              <li className={activePage('secrets')}>
                <Link href="/secrets">
                  <ion-icon name="key-outline"></ion-icon>
                  <span className={styles.title}>Secrets</span>
                </Link>
              </li>
              <li className={activePage('environments')}>
                <Link href="/environments">
                  <ion-icon name="settings-outline"></ion-icon>
                  <span className={styles.title}>Environments</span>
                </Link>
              </li>
              <li className={activePage('webhooks')}>
                <Link href="/webhooks">
                  <ion-icon name="flash-outline"></ion-icon>
                  <span className={styles.title}>Webhooks</span>
                </Link>
              </li>
              <li className={activePage('audit')}>
                <Link href="/audit">
                  <ion-icon name="reader-outline"></ion-icon>
                  <span className={styles.title}>Audit Log</span>
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className={styles.profile}>
          <div className={styles['profile-pic']}></div>
          <div className={styles['profile-details']}>
            <div className={styles.user}>
              <div className={styles.name}>Coco</div>
              <div className={styles.role}>ADMIN</div>
            </div>
            <ion-icon name="chevron-up-outline"></ion-icon>
          </div>
        </div>

      </aside>

      <div className={styles['profile-options']}>
        <div className={styles['profile-menu']}>
          <div className={styles['profile-view']}>Profile</div>
          <div className={styles['sign-out']}>Sign Out</div>
        </div>
      </div>

      {activePage('run-detail') ? (
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