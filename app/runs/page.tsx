"use client"

import { useState } from 'react';
import styles from "./run-history.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/sidebar/Sidebar";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import Pill from '@/components/Pill';
import type { PillVariant } from '@/components/Pill';
import RunHistoryModal from "@/components/modals/RunHistoryModal";

const RUNS: {
  runId: number;
  status: PillVariant; statusLabel: string;
  pipeline: string; repo: string;
  environment: PillVariant; environmentLabel: string;
  trigger: PillVariant; triggerLabel: string;
  duration: string; time: string;
}[] = [
  { runId: 1, status: 'queued', statusLabel: 'Queued', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'production', environmentLabel: 'Production', trigger: 'webhook', triggerLabel: 'Webhook', duration: '-', time: '6h ago' },
  { runId: 2, status: 'running', statusLabel: 'Running', pipeline: 'build-frontend', repo: 'acbcd/web-client', environment: 'staging', environmentLabel: 'Staging', trigger: 'manual', triggerLabel: 'Manual', duration: '6h 1m', time: '6h ago' },
  { runId: 3, status: 'succeeded', statusLabel: 'Succeeded', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'development', environmentLabel: 'Development', trigger: 'api', triggerLabel: 'API', duration: '8m 0s', time: '11h ago' },
  { runId: 4, status: 'failed', statusLabel: 'Failed', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'preview', environmentLabel: 'Preview', trigger: 'webhook', triggerLabel: 'Webhook', duration: '8m 0s', time: '11h ago' },
  { runId: 5, status: 'cancelled', statusLabel: 'Cancelled', pipeline: 'deploy-api', repo: 'acbcd/api-server', environment: 'custom', environmentLabel: 'Custom', trigger: 'manual', triggerLabel: 'Manual', duration: '8m 0s', time: '12h ago' },
];

type ModalState = { mode: 'view'; row: number } | null;

export default function RunHistory() {
  const [modal, setModal] = useState<ModalState>(null);

  const selectedRun = modal?.mode === 'view' ? RUNS[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="run-history"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Run History"
          subtitle="All pipeline executions across your projects."
          badge={{ count: 3, label: 'Active' }}>
          <button>
            <ion-icon name="caret-forward-outline"></ion-icon>
            Run Pipeline
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search pipelines, commits..."} />
            <FilterSelect
              id={"status"} name={"status"}
              options={
                [
                  { value: "all", label: "All statuses" },
                  { value: "queued", label: "Queued" },
                  { value: "running", label: "Running" },
                  { value: "succeeded", label: "Succeeded" },
                  { value: "failed", label: "Failed" },
                  { value: "cancelled", label: "Cancelled" },
                ]
              } />
            <FilterSelect
              id={"trigger"} name={"trigger"}
              options={
                [
                  { value: "all", label: "All triggers" },
                  { value: "webhook", label: "Webhook" },
                  { value: "manual", label: "Manual" },
                  { value: "api", label: "API" },
                ]
              } />
            <FilterSelect
              id={"environment"} name={"environment"}
              options={
                [
                  { value: "all", label: "All environment types" },
                  { value: "production", label: "Production" },
                  { value: "staging", label: "Staging" },
                  { value: "development", label: "Development" },
                  { value: "preview", label: "Preview" },
                  { value: "custom", label: "Custom" },
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
          columns={["Pipeline", "Environment Type", "Trigger", "Duration", "Time"]}>
          {RUNS.map((run, i) => (
            <tr key={i} className={styles["clickable-row"]} onClick={() => setModal({ mode: 'view', row: i })}>
              <td><Pill variant={run.status} label={run.statusLabel} /> {run.pipeline} <br /><span>{run.repo}</span></td>
              <td><Pill variant={run.environment} label={run.environmentLabel} /></td>
              <td><Pill variant={run.trigger} label={run.triggerLabel} /></td>
              <td className={styles.filter}>
                <ion-icon name="stopwatch-outline"></ion-icon>
                <div className="nowrap">{run.duration}</div>
              </td>
              <td className="nowrap">{run.time}</td>
            </tr>
          ))}
        </DataTable>

        <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>

      {modal && (
        <RunHistoryModal
          initialMode={modal.mode}
          {...selectedRun}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
