"use client"

import { useState } from 'react';
import styles from './env.module.css';
import Sidebar from "@/components/Sidebar"
import Subheader from "@/components/Subheader";
import StatCards from '@/components/StatCards';
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from '@/components/Pagination';
import Pill from '@/components/Pill';
import EnvironmentModal from '@/components/modals/EnvironmentModal';

type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

const ENVIRONMENTS: { name: string; type: EnvType; requireApproval?: boolean; createdBy: string, createdAt: string, updatedAt: string }[] = [
  { name: 'dev',  type: 'development', requireApproval: true,  createdBy: 'coco', createdAt: '6/9/26 -- 21:27:34', updatedAt: '6/9/26 -- 21:27:34' },
  { name: 'staging', type: 'staging', requireApproval: false, createdBy: 'coco', createdAt: '6/9/26 -- 21:27:34', updatedAt: '6/9/26 -- 21:27:34' },
  { name: 'prod', type: 'production', requireApproval: false, createdBy: 'coco', createdAt: '6/9/26 -- 21:27:34', updatedAt: '6/9/26 -- 21:27:34' },
  { name: 'prev', type: 'preview', requireApproval: false, createdBy: 'coco', createdAt: '6/9/26 -- 21:27:34', updatedAt: '6/9/26 -- 21:27:34' },
  { name: 'custom', type: 'custom', requireApproval: false, createdBy: 'coco', createdAt: '6/9/26 -- 21:27:34', updatedAt: '6/9/26 -- 21:27:34' },
];

type ModalState = { mode: 'view'; row: number } | { mode: 'edit' } | { mode: 'create'} | null;

export default function Environments() {
  const [modal, setModal] = useState<ModalState>(null);
  const [modalKey, setModalKey] = useState(0);

  const selectedEnv = modal?.mode === 'view' ? ENVIRONMENTS[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="environments"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Environments"
          subtitle="Manage deploy targets and their secret scoping.">
          <button onClick={() => setModal({ mode: 'create' })}>
            <ion-icon name="add-outline"></ion-icon>
            Create Environment
          </button>
        </Subheader>

        <StatCards
          cards={[
            { icon: "settings-outline", total: 5, label: "ENVIRONMENTS" },
            { icon: "key-outline", total: 5, label: "TOTAL SECRETS" },
            { icon: "shield-outline", total: 1, label: "PROTECTED" },
            { icon: "git-branch-outline", total: 11, label: "PIPELINE BINDINGS" },
          ]}>
        </StatCards>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput placeholder={"Search environments..."} />
            <FilterSelect
              id={"environment"} name={"environment"}
              options={[
                { value: "all", label: "All environment types" },
                { value: "production", label: "Production" },
                { value: "staging", label: "Staging" },
                { value: "development", label: "Development" },
                { value: "preview", label: "Preview" },
                { value: "custom", label: "Custom" },
              ]} />
            <FilterSelect
              id={"status"} name={"status"}
              options={[
                { value: "all", label: "All time" },
                { value: "today", label: "Today" },
                { value: "7days", label: "Last 7 days" },
                { value: "30days", label: "Last 30 days" },
                { value: "90days", label: "Last 90 days" },
              ]} />
          </div>
        </div>

        <DataTable columns={["Name", "Environment Type", "Secrets", "Pipelines", "Last Updated"]}>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 0 })}>
            <td className={styles.filter}>
              <div>dev</div>
            </td>
            <td><Pill variant="development" label="Development" /></td>
            <td className={styles.filter}><ion-icon name="key-outline"></ion-icon><div>14</div></td>
            <td>6</td>
            <td>4d ago</td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 1 })}>
            <td className={styles.filter}><div>staging</div></td>
            <td><Pill variant="staging" label="Staging" /></td>
            <td className={styles.filter}><ion-icon name="key-outline"></ion-icon><div>12</div></td>
            <td>2</td>
            <td>4d ago</td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 2 })}>
            <td className={styles.filter}><div>prod</div>
              <ion-icon name="lock-closed-outline"></ion-icon>
            </td>
            <td><Pill variant="production" label="Production" /></td>
            <td className={styles.filter}><ion-icon name="key-outline"></ion-icon><div>8</div></td>
            <td>3</td>
            <td>8d ago</td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 3 })}>
            <td className={styles.filter}><div>prev</div></td>
            <td><Pill variant="preview" label="Preview" /></td>
            <td className={styles.filter}><ion-icon name="key-outline"></ion-icon><div>8</div></td>
            <td>3</td>
            <td>8d ago</td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 4 })}>
            <td className={styles.filter}><div>custom</div></td>
            <td><Pill variant="custom" label="Custom" /></td>
            <td className={styles.filter}><ion-icon name="key-outline"></ion-icon><div>8</div></td>
            <td>3</td>
            <td>8d ago</td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>

      {modal && (
        <EnvironmentModal
          key={modalKey}
          initialMode={modal.mode}
          {...selectedEnv}
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
