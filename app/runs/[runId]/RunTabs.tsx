"use client"

import { useState, type ReactNode } from "react";
import styles from "./run-detail.module.css";
import TabsRow from "@/components/run-detail/TabsRow";

type Tab = 'overview' | 'logs'

interface RunTabsProps {
  overview: ReactNode;
  logs: ReactNode;
}

export default function RunTabs({ overview, logs }: RunTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const toggleOverview = () => setActiveTab('overview')
  const toggleLogs = () => setActiveTab('logs')

  return (
    <>
      <TabsRow
        activeTab={activeTab}
        toggleOverview={toggleOverview}
        toggleLogs={toggleLogs}
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
