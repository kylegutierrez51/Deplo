"use client"

import { useState, type ReactNode } from "react";
import styles from "./run-detail.module.css";
import TabsRow from "@/components/run-detail/TabsRow";

type Tab = 'overview' | 'logs'

interface RunDetailShellProps {
  header: ReactNode;
  overview: ReactNode;
  logs: ReactNode;
}

export default function RunDetailShell({ header, overview, logs }: RunDetailShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const toggleOverview = () => setActiveTab('overview')
  const toggleLogs = () => setActiveTab('logs')
  const toggleCollapsed = () => setCollapsed(c => !c)

  return (
    <>
      <div
        id="run-header"
        className={styles['run-header']}
        data-collapsed={collapsed}
        inert={collapsed}
      >
        <div className={styles['run-header-inner']}>
          {header}
        </div>
      </div>

      <TabsRow
        activeTab={activeTab}
        toggleOverview={toggleOverview}
        toggleLogs={toggleLogs}
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
      />

      <section className={styles.overview} id="section-overview" style={{ display: activeTab === 'overview' ? undefined : 'none' }}>
        {overview}
      </section>

      <section className={styles.logs} id="section-logs" style={{ display: activeTab === 'logs' ? undefined : 'none' }}>
        {logs}
      </section>
    </>
  )
}
