"use client"

import styles from './tabs-row.module.css'

interface TabsRowProps {
  activeTab: string;
  toggleOverview: () => void;
  toggleLogs: () => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}
export default function TabsRow({ activeTab, toggleOverview, toggleLogs, collapsed, toggleCollapsed }: TabsRowProps) {
  const collapseLabel = collapsed ? 'Show run details' : 'Hide run details';

  return (
    <div className={styles.tabs}>
      <div className={styles['tabs-row']}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={toggleOverview}
        >
          <ion-icon name="layers-outline"></ion-icon>
          <span>Overview</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
          onClick={toggleLogs}
        >
          <ion-icon name="receipt-outline"></ion-icon>
          <span>Logs</span>
        </button>
      </div>

      <button
        type="button"
        className={styles['collapse-toggle']}
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="run-header"
        aria-label={collapseLabel}
        title={collapseLabel}
      >
        <ion-icon name="chevron-up-outline"></ion-icon>
      </button>
    </div>
  )
}
