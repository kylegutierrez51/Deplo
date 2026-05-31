"use client"
import Link from 'next/link';
import styles from './sidebar.module.css'

type ActiveItem = 'pipelines' | 'run-history' | 'run-detail' | 'approvals' | 'secrets' | 'environments' | 'webhooks' | 'audit';

interface SidebarProps {
  activeItem?: ActiveItem;  
}

export default function Sidebar({ activeItem }: SidebarProps) {
  const active = (item: ActiveItem) => activeItem === item ? styles['nav-item-active'] : undefined;
  return (
    <>
      <aside className={styles.sidebar}>

        <nav className={styles['sidebar-nav']} aria-label="Main">
          <div className={styles['sidebar-content']}>
            <span className={styles.subtitle}>DEPLOY</span>
            <ul>
              <li className={active('pipelines')}>
                <Link href="/pipelines">
                  <ion-icon name="git-network-outline"></ion-icon>
                  <span className={styles.title}>Pipelines</span>
                </Link>
              </li>
              <li className={active('run-history') || active('run-detail')}>
                <Link href="/runs">
                  <ion-icon name="time-outline"></ion-icon>
                  <span className={styles.title}>Run History</span>
                </Link>
              </li>
              <li className={active('approvals')}>
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
              <li className={active('secrets')}>
                <Link href="/secrets">
                  <ion-icon name="key-outline"></ion-icon>
                  <span className={styles.title}>Secrets</span>
                </Link>
              </li>
              <li className={active('environments')}>
                <Link href="/environments">
                  <ion-icon name="settings-outline"></ion-icon>
                  <span className={styles.title}>Environments</span>
                </Link>
              </li>
              <li className={active('webhooks')}>
                <Link href="/webhooks">
                  <ion-icon name="flash-outline"></ion-icon>
                  <span className={styles.title}>Webhooks</span>
                </Link>
              </li>
              <li className={active('audit')}>
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

      {active('run-detail') ? (
        <div className={styles.topbar}>
          <button className={styles['sidebar-toggle']} id="sidebarToggle">
            <ion-icon name="menu-outline"></ion-icon>
          </button>
      
          <a href="run-history.html" className={styles['back-link']}>
            <ion-icon name="arrow-back-outline"></ion-icon>
            Run History
          </a>
        </div>
      ) :
        <button className={styles['sidebar-toggle']} id="sidebarToggle">
        <ion-icon name="menu-outline"></ion-icon>
      </button>   
      }

    </>
  )
}