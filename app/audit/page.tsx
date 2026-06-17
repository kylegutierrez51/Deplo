"use client"

import styles from "./audit.module.css";
import Sidebar from "@/components/sidebar/Sidebar";
import Subheader from "@/components/Subheader";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import AuditModal from "@/components/modals/AuditModal";
import { useState } from 'react';


const AUDITS: { action: string, resource: string, category?: string, actor: string, createdBy?: string, time: string}[] = [
  { action: 'Run Completed', resource: 'deploy-api #482', category: "Pipeline", actor: 'github', time: '6/9/26, 21:27:34' },
  { action: 'Pipeline Triggered', resource: 'deploy-api #482', category: "Pipeline", actor: 'github', time: '6/9/26, 21:27:34' },
  { action: 'Webhook Received', resource: 'push → acme/api-server', category: "Webhook", actor: 'github', time: '6/9/26, 21:27:34' },
];

type ModalState = { mode: 'view'; row: number } | null;

export default function AuditLog() {
  const [modal, setModal] = useState<ModalState>(null);

  const selectedAudit = modal?.mode === 'view' ? AUDITS[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="audit"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Audit Log"
          subtitle="Immutable record of every action taken across your workspace.">
          <button>
            <ion-icon name="download-outline"></ion-icon>
            Export
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search events, users, resources..."} />
            <FilterSelect
              id={"actions"} name={"actions"}
              options={
                [
                  { value: "all", label: "All actions" },
                  { value: "pipeline", label: "Pipeline" },
                  { value: "run", label: "Runs" },
                  { value: "approval", label: "Approvals" },
                  { value: "secret", label: "Secrets" },
                  { value: "webhook", label: "Webhooks" },
                  { value: "settings", label: "Settings" },
                ]
              } />
            <FilterSelect
              id={"status"} name={"status"}
              options={
                [
                  { value: "all", label: "All time" },
                  { value: "today", label: "Today" },
                  { value: "7days", label: "Last 7 days" },
                  { value: "30days", label: "Last 30 days" },
                  { value: "90days", label: "Last 90 days" },
                ]
              } />
            <FilterSelect
              id={"recency"} name={"recency"}
              options={
                [
                  { value: "most-recent", label: "Most recent" },
                  { value: "least-recent", label: "Least recent" }
                ]
              } />
          </div>
        </div>

        <DataTable
          columns={["Action", "Resource", "Actor", "Time"]}>
          {AUDITS.map((audit, i) => (
            <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 0 })}>
              <td>{audit.action}</td>
              <td>push → acme/api-server <span className={styles['audit-category']}>[{audit.category}]</span></td>
              <td>{audit.actor}</td>
              <td className={styles.nowrap}>{audit.time}</td>
            </tr>
          ))}
        </DataTable>

        <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
  
      {modal && (
        <AuditModal
          initialMode={modal.mode}
          {...selectedAudit}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}