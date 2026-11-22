import Link from 'next/link';
import styles from './sidebar.module.css'
import Profile from './Profile'
import SidebarShell from './SidebarShell';

type ActiveItem = 'dashboard' | 'pipelines' | 'run-history' | 'run-detail' | 'approvals' | 'secrets' | 'environments' | 'webhooks' | 'webhook-events' | 'audit';

interface SidebarProps {
  activeItem?: ActiveItem;
  showToggle?: boolean; // used by Pipeline Editor page
}

export default function Sidebar({ activeItem, showToggle = true }: SidebarProps) {

  const activePage = (item: ActiveItem) => activeItem === item ? styles['nav-item-active'] : undefined;

  return (
    <SidebarShell activeItem={activeItem} showToggle={showToggle}>
      <Link href="/" className={styles.brand} aria-label="Deplo home">
        <span className={styles['brand-mark']} aria-hidden="true"><ion-icon name="git-network-outline"></ion-icon></span>
        <span>Deplo</span>
      </Link>
      <nav className={styles['sidebar-nav']} aria-label="Main">
        <div className={styles['sidebar-content']}>
          <span className={styles.subtitle}>Overview</span>
          <ul>
            <li className={activePage('dashboard')}>
              <Link href="/" aria-current={activeItem === 'dashboard' ? 'page' : undefined}>
                <ion-icon name="grid-outline"></ion-icon>
                <span className={styles.title}>Dashboard</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles['sidebar-content']}>
          <span className={styles.subtitle}>Deploy</span>
          <ul>
            <li className={activePage('pipelines')}>
              <Link href="/pipelines" aria-current={activeItem === 'pipelines' ? 'page' : undefined}>
                <ion-icon name="git-network-outline"></ion-icon>
                <span className={styles.title}>Pipelines</span>
              </Link>
            </li>
            <li className={activePage('run-history') || activePage('run-detail')}>
              <Link href="/runs" aria-current={activeItem === 'run-history' || activeItem === 'run-detail' ? 'page' : undefined}>
                <ion-icon name="time-outline"></ion-icon>
                <span className={styles.title}>Run History</span>
              </Link>
            </li>
            <li className={activePage('approvals')}>
              <Link href="/approvals" aria-current={activeItem === 'approvals' ? 'page' : undefined}>
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                <span className={styles.title}>Approvals</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles['sidebar-content']}>
          <span className={styles.subtitle}>Manage</span>
          <ul>
            <li className={activePage('secrets')}>
              <Link href="/secrets" aria-current={activeItem === 'secrets' ? 'page' : undefined}>
                <ion-icon name="key-outline"></ion-icon>
                <span className={styles.title}>Secrets</span>
              </Link>
            </li>
            <li className={activePage('environments')}>
              <Link href="/environments" aria-current={activeItem === 'environments' ? 'page' : undefined}>
                <ion-icon name="settings-outline"></ion-icon>
                <span className={styles.title}>Environments</span>
              </Link>
            </li>
            <li className={activePage('webhooks') || activePage('webhook-events')}>
              <Link href="/webhooks" aria-current={activeItem === 'webhooks' || activeItem === 'webhook-events' ? 'page' : undefined}>
                <ion-icon name="flash-outline"></ion-icon>
                <span className={styles.title}>Webhooks</span>
              </Link>
            </li>
            <li className={activePage('audit')}>
              <Link href="/audits" aria-current={activeItem === 'audit' ? 'page' : undefined}>
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
