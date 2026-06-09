"use client"

import { useState } from 'react';
import styles from "./secrets.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/Sidebar";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import Pill from '@/components/Pill';
import SecretModal from '@/components/modals/SecretModal';

type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

const SECRETS: { secretKey: string; value: string; notes?: string; environmentType: EnvType; createdBy: string }[] = [
  { secretKey: 'DATABASE_URL', value: 'asidaifaegauidfgaybaw2', notes: 'Primary Postgres connection — pool size 20, read replica enabled', environmentType: 'production',  createdBy: 'sarah.chen' },
  { secretKey: 'DATABASE_URL', value: "asidaifaegauidfgaybaw2", environmentType: 'staging',      createdBy: 'sarah.chen' },
  { secretKey: 'GITHUB_TOKEN', value: 'asidaifaegauidfgaybaw2', notes: 'Fine-grained PAT scoped to acme org, expires 2025-01-01', environmentType: 'development',  createdBy: 'marcus.coco' },
  { secretKey: 'GITHUB_TOKEN', value: 'asidaifaegauidfgaybaw2', notes: 'Fine-grained PAT scoped to acme org, expires 2025-01-01', environmentType: 'preview', createdBy: 'marcus.coco' },
  { secretKey: 'GITHUB_TOKEN', value: 'asidaifaegauidfgaybaw2',  notes: 'Fine-grained PAT scoped to acme org, expires 2025-01-01', environmentType: 'custom', createdBy: 'marcus.coco' },
];

type ModalState = { mode: 'view'; row: number } | { mode: 'edit' } | { mode: 'create' } | null;

export default function Secrets() {
  const [modal, setModal] = useState<ModalState>(null);
  const [modalKey, setModalKey] = useState(0);

  const selectedSecret = modal?.mode === 'view' ? SECRETS[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="secrets"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Secrets"
          subtitle="Encrypted environment variables injected into pipeline stages at runtime.">
          <button onClick={() => setModal({ mode: 'create' })}>
            <ion-icon name="add-outline"></ion-icon>
            Add Secret
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput placeholder={"Filter by key or notes..."} />
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
          </div>
        </div>

        <DataTable columns={["Key", "Environment Name", "Updated"]}>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 0 })}>
            <td>DATABASE_URL<br /><span>Primary Postgres connection -- pool...</span></td>
            <td><Pill variant="production" label="prod" /></td>
            <td className="nowrap">11d ago</td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 1 })}>
            <td>DATABASE_URL<br /></td>
            <td><Pill variant="staging" label="staging" /></td>
            <td className="nowrap">13d ago</td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 2 })}>
            <td>GITHUB_TOKEN<br /><span>Fine-grained PAT scoped to acme or...</span></td>
            <td><Pill variant="development" label="dev" /></td>
            <td className="nowrap">12d ago <br /><span className="nowrap">5m 12s</span></td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 3 })}>
            <td>GITHUB_TOKEN<br /><span>Fine-grained PAT scoped to acme or...</span></td>
            <td><Pill variant="preview" label="prev" /></td>
            <td className="nowrap">12d ago <br /><span className="nowrap">5m 12s</span></td>
          </tr>
          <tr style={{ cursor: 'pointer' }} onClick={() => setModal({ mode: 'view', row: 4 })}>
            <td>GITHUB_TOKEN<br /><span>Fine-grained PAT scoped to acme or...</span></td>
            <td><Pill variant="custom" label="custom" /></td>
            <td className="nowrap">12d ago <br /><span className="nowrap">5m 12s</span></td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>

      {modal && (
        <SecretModal
          key={modalKey}
          initialMode={modal.mode}
          {...selectedSecret}
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

// OnSave()'s "setModalKey" remounts the SecretModal component. So when you press "Save Changes", reinitialize the SecretModal with this page.tsx's props:

// modal          = { mode: 'view', row: 2 }   ← unchanged since row was clicked
// selectedSecret = SECRETS[2]                 ← still the right data

