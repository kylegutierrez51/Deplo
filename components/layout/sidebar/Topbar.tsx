"use client"

import styles from './sidebar.module.css';
import Link from 'next/link';
import { useSidebar } from './SidebarContext';

interface TopbarProps {
  activeItem: string | undefined;
  showToggle: boolean;
}

// sub-pages that show a back-link to their parent beside the sidebar toggle
const BACK_LINKS: Record<string, { href: string, label: string }> = {
  'run-detail': { href: '/runs', label: 'Run History' },
  'webhook-events': { href: '/webhooks', label: 'Webhooks' },
};

export default function Topbar({ activeItem, showToggle }: TopbarProps) {
  const { toggle } = useSidebar();
  const back = activeItem ? BACK_LINKS[activeItem] : undefined;

  return (
    <>
      {back ? (
        <div className={styles.topbar}>
          <button className={styles["sidebar-toggle"]} id="sidebarToggle" onClick={toggle} aria-label="Toggle sidebar">
            <ion-icon name="menu-outline"></ion-icon>
          </button>

          <Link href={back.href} className={styles['back-link']}>
            <ion-icon name="arrow-back-outline"></ion-icon>
            {back.label}
          </Link>
        </div>
      ) : showToggle && (
        <button className={styles["sidebar-toggle"]} id="sidebarToggle" onClick={toggle} aria-label="Toggle sidebar">
          <ion-icon name="menu-outline"></ion-icon>
        </button>
      )}
    </>
  )
}
