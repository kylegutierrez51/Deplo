"use client"

import styles from './tabs-row.module.css';
import type { ReactNode } from 'react';

interface TabsRowProps {
  activeTab: string;
  summary?: ReactNode;
  toggleOverview: () => void;
  toggleLogs: () => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}
export default function TabsRow({ activeTab, summary, toggleOverview, toggleLogs, collapsed, toggleCollapsed }: TabsRowProps) {
  const collapseLabel = collapsed ? 'Show run details' : 'Hide run details';

  return (
    <div className={styles.tabs}>
      {summary && <div className={styles.summary}>{summary}</div>}
      <div className={styles['tabs-row']}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          aria-pressed={activeTab === 'overview'}
          onClick={toggleOverview}
        >
          <ion-icon name="layers-outline"></ion-icon>
          <span>Overview</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
          aria-pressed={activeTab === 'logs'}
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
