"use client"

import { useState } from 'react';
import styles from "./webhook-events.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/sidebar/Sidebar";
import StatCards from "@/components/StatCards";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import Pill from '@/components/Pill';
import type { PillVariant } from '@/components/Pill';
import WebhookEventModal from "@/components/modals/WebhookEventModal";

const WEBHOOK_EVENTS: {
  status: PillVariant; statusLabel: string;
  eventType: PillVariant; eventLabel: string;
  repository: string; branch: string;
  commitHash: string; commitMessage: string;
  pipeline: string; received: string;
}[] = [
  { status: 'pending', statusLabel: 'Pending', eventType: 'pull-request', eventLabel: 'pull_request', repository: 'abcd/api-server', branch: 'main', commitHash: 'a1b2c3d', commitMessage: 'feat: add retry logic to webhook delivery handler', pipeline: 'deploy-api', received: '1h ago' },
  { status: 'processed', statusLabel: 'Processed', eventType: 'push', eventLabel: 'push', repository: 'abcd/api-server', branch: 'main', commitHash: 'a1b2c3d', commitMessage: 'feat: add retry logic to webhook delivery handler', pipeline: 'deploy-api', received: '1h ago' },
  { status: 'ignored', statusLabel: 'Ignored', eventType: 'push', eventLabel: 'push', repository: 'abcd/web-client', branch: 'release/v2.4.0', commitHash: 'f4e5d6c', commitMessage: 'chore: bump dependencies to latest stable versions', pipeline: 'build-frontend', received: '2h ago' },
  { status: 'failed', statusLabel: 'Failed', eventType: 'pull-request', eventLabel: 'pull_request', repository: 'abcd/web-client', branch: 'feature/auth-flow', commitHash: '7890abc', commitMessage: 'feat: add user role migration for RBAC system', pipeline: 'db-migrate', received: '3h ago' },
];

type ModalState = { mode: 'view'; row: number } | null;

export default function Webhooks() {
  const [modal, setModal] = useState<ModalState>(null);

  const selectedEvent = modal?.mode === 'view' ? WEBHOOK_EVENTS[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="webhooks"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Webhook Events"
          subtitle="Incoming webhook deliveries from GitHub.">
          <button>
            <ion-icon name="refresh-outline"></ion-icon>
            Refresh
          </button>
        </Subheader>

        <StatCards
          cards={
            [
              { icon: "time-outline", total: 1, label: "PENDING", valueClassName: 'pending' },
              { icon: "checkmark-circle-outline", total: 3, label: "PROCESSED", valueClassName: 'processed' },
              { icon: "remove-circle-outline", total: 2, label: "IGNORED", valueClassName: 'ignored' },
              { icon: "close-circle-outline", total: 2, label: "FAILED", valueClassName: 'failed' },
            ]
          }>
        </StatCards>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search repo, branch, commit, pipeline, delivery ID..."}
              styles={styles} />
            <FilterSelect
              id={"status"} name={"status"}
              styles={styles}
              options={
                [
                  { value: "all", label: "All statuses" },
                  { value: "succeeded", label: "Processed" },
                  { value: "pending", label: "Pending" },
                  { value: "failed", label: "Ignored" },
                  { value: "running", label: "Running" },
                ]
              } />
            <FilterSelect
              id={"event-type"} name={"event-type"}
              styles={styles}
              options={
                [
                  { value: "all", label: "All event types" },
                  { value: "today", label: "push" },
                  { value: "7days", label: "pull_request" },
                ]
              } />
          </div>
        </div>

        <DataTable
          columns={["Status", "Event", "Repository", "Branch", "Commit", "Pipeline", "Received"]}>
          {WEBHOOK_EVENTS.map((event, i) => (
            <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: i })}>
              <td><Pill variant={event.status} label={event.statusLabel} /></td>
              <td><Pill variant={event.eventType} label={event.eventLabel} /></td>
              <td>{event.repository}</td>
              <td>{event.branch}</td>
              <td>{event.commitHash}<br /><span>{event.commitMessage}</span></td>
              <td>{event.pipeline}</td>
              <td>{event.received}</td>
            </tr>
          ))}
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>

      {modal && (
        <WebhookEventModal
          initialMode={modal.mode}
          {...selectedEvent}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
