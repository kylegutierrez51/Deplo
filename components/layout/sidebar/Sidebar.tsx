import Link from 'next/link';
import styles from './sidebar.module.css'
import Profile from './Profile'
import SidebarShell from './SidebarShell';

type ActiveItem = 'pipelines' | 'run-history' | 'run-detail' | 'approvals' | 'secrets' | 'environments' | 'webhooks' | 'audit';

interface SidebarProps {
  activeItem?: ActiveItem;
  showToggle?: boolean; // used by Pipeline Editor page
}

export default function Sidebar({ activeItem, showToggle = true }: SidebarProps) {

  const activePage = (item: ActiveItem) => activeItem === item ? styles['nav-item-active'] : undefined;

  return (
    <SidebarShell activeItem={activeItem} showToggle={showToggle}>
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
              <Link href="/audits">
                <ion-icon name="reader-outline"></ion-icon>
                <span className={styles.title}>Audit Log</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <Profile />
    </SidebarShell>
  )
}
