"use client"

import styles from './tabs-row.module.css'

interface TabsRowProps {
  activeTab: string;
  toggleOverview: () => void;
  toggleLogs: () => void;
}
export default function Subheader({ activeTab, toggleOverview, toggleLogs }: TabsRowProps) {
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
    </div>
  )
}