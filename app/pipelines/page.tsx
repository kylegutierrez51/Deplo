"use client"

import { useState } from 'react';
import styles from "./pipelines.module.css"

import Sidebar from "@/components/Sidebar";
import Subheader from "@/components/Subheader";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import Pill from '@/components/Pill';
import PipelineModal from '@/components/modals/PipelineModal';

const PIPELINES = [
  { name: 'build-frontend',  repoUrl: 'https://github.com/abcd/web-client',  description: 'Builds and deploys the web client on every push to main', branchFilters: ['main', 'release/*', 'hotfix/*'], createdBy: 'coco' },
  { name: 'deploy-api',      repoUrl: 'https://github.com/abcd/api-server',   branchFilters: ['main'],                                                 createdBy: 'coco' },
  { name: 'release-mobile',  repoUrl: 'https://github.com/abcd/mobile-app',   branchFilters: ['main', 'release/*'],                                    createdBy: 'coco' },
  { name: 'release-mobile',  repoUrl: 'https://github.com/abcd/mobile-app',   branchFilters: ['main'],                                                 createdBy: 'coco' },
  { name: 'release-mobile',  repoUrl: 'https://github.com/abcd/mobile-app',   branchFilters: [],                                                       createdBy: 'coco' },
];

type ModalState = { mode: 'view'; row: number } | { mode: 'edit' } | { mode: 'create' } | null;

export default function PipelineList() {
  const [modal, setModal] = useState<ModalState>(null);
  const [modalKey, setModalKey] = useState(0);

  const selectedPipeline = modal?.mode === 'view' ? PIPELINES[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="pipelines"></Sidebar>

      <main className="page-content">
        <Subheader
          title="Pipelines"
          subtitle={<><span id="subtitle-count">8</span> pipelines across your repositories</>}>
          <button onClick={() => setModal({ mode: 'create' })}>
            <ion-icon name="add-outline"></ion-icon>
            New Pipeline
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput placeholder={"Search pipelines..."} />
            <FilterSelect
              id={"status"} name={"status"}
              options={[
                { value: "all", label: "All statuses" },
                { value: "queued", label: "Queued" },
                { value: "running", label: "Running" },
                { value: "succeeded", label: "Succeeded" },
                { value: "failed", label: "Failed" },
                { value: "cancelled", label: "Cancelled" },
              ]} />
          </div>
        </div>

        <DataTable columns={["Pipeline", "Status", "Repository", "Last Run"]}>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 0 })}>
            <td>build-frontend <br /><span className="nowrap">79 runs</span></td>
            <td><Pill variant="running" label="Running" /></td>
            <td>abcd/web-client<br /><span>f4e5d6c feat: add retry logic to webhook...</span></td>
            <td className="nowrap">1h ago <br /><span className="nowrap">2m 14s</span></td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 1 })}>
            <td>deploy-api <br /><span className="nowrap">182 runs</span></td>
            <td><Pill variant="succeeded" label="Succeeded" /></td>
            <td>abcd/api-server<br /><span>a1b2c3d fix: resolve connection pool exh...</span></td>
            <td className="nowrap">1h ago <br /><span className="nowrap">7m 7s</span></td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 2 })}>
            <td>release-mobile <br /><span className="nowrap">68 runs</span></td>
            <td><Pill variant="failed" label="Failed" /></td>
            <td>abcd/mobile-app<br /><span>7890abc chore: bump dependencies to l...</span></td>
            <td className="nowrap">2h ago <br /><span className="nowrap">5m 12s</span></td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 3 })}>
            <td>release-mobile <br /><span className="nowrap">54 runs</span></td>
            <td><Pill variant="queued" label="Queued" /></td>
            <td>abcd/mobile-app<br /><span>7890abc chore: bump dependencies to l...</span></td>
            <td className="nowrap">2h ago <br /><span className="nowrap">5m 12s</span></td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 4 })}>
            <td>release-mobile <br /><span className="nowrap">22 runs</span></td>
            <td><Pill variant="cancelled" label="Cancelled" /></td>
            <td>abcd/mobile-app<br /><span>7890abc chore: bump dependencies to l...</span></td>
            <td className="nowrap">2h ago <br /><span className="nowrap">5m 12s</span></td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>

      {modal && (
        <PipelineModal
          key={modalKey}
          initialMode={modal.mode}
          {...selectedPipeline}
          onClose={() => setModal(null)}
          onDelete={() => setModal(null)}
          onSave={() => {
            if (modal.mode === 'view') {
              setModalKey(k => k + 1); 
            } else {
              setModal(null);
            }
          }}
        />
      )}
    </>
  )
}
