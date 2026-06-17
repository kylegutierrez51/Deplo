"use client"

import { useState } from 'react';
import styles from "./webhooks.module.css"
import Subheader from "@/components/subheader/Subheader"
import AddButton from '@/components/subheader/AddButton';
import Sidebar from "@/components/sidebar/Sidebar"
import FilterSelect from "@/components/filters/FilterSelect"
import SearchInput from "@/components/filters/SearchInput";
import WebhookCard from "@/components/WebhookCard";
import Pagination from "@/components/Pagination"
import WebhookModal from '@/components/modals/WebhookModal';

const WEBHOOKS = [
  { repository: 'abcd/infra', pipeline: 'deploy-infra', events: { push: true, pullRequest: true }, branchFilters: ['main/*', 'release/*', 'hotfix/*'], webhookSecret: 'whsec_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', createdBy: 'coco', lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
  { repository: 'abcd/infra', pipeline: 'deploy-infra', events: { push: true, pullRequest: false }, webhookSecret: 'whsec_b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
  { repository: 'abcd/api-server', pipeline: 'deploy-api', events: { push: false, pullRequest: true }, webhookSecret: 'whsec_c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', lastDelivery: '6/9/26, 21:27:34', registeredAgo: '6/9/26, 21:27:34' },
];

type ModalState = { mode: 'view'; row: number } | { mode: 'edit' } | { mode: 'create' } | null;

export default function Webhooks() {
  const [modal, setModal] = useState<ModalState>(null);
  const [modalKey, setModalKey] = useState(0);

  const selectedWebhook = modal?.mode === 'view' ? WEBHOOKS[modal.row] : undefined;

  return (
    <>
      <Sidebar activeItem="webhooks" />

      <main className="page-content">
        <div className="page-layout">

          <Subheader
            title="GitHub Webhooks"
            subtitle="Register webhooks to automatically trigger pipelines on push or pull request events.">
            <AddButton text={"Add Webhook"} url={"webhooks"} />
          </Subheader>

          <div className={styles.filters}>
            <div className={styles['filters-bar']}>
              <SearchInput placeholder={"Search webhooks..."} />
              <FilterSelect
                id={"active"} name={"active"}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" }
                ]} />
              <FilterSelect
                id={"recency"} name={"recency"}
                options={[
                  { value: "most-recent", label: "Most recently registered" },
                  { value: "least-recent", label: "Least recently registered" }
                ]} />
            </div>
          </div>

          <div className={styles['webhook-layout']}>
            <div className={styles['webhook-card-wrapper']} onClick={() => setModal({ mode: 'view', row: 0 })}>
              <WebhookCard
                repo={"abcd/infra"}
                status={"Inactive"}
                events={["push", "pull_request"]}
                lastDelivery={"10d"}
                registeredAgo={"63d"}
                branchFilters={['main/*', 'release/*']} />
            </div>

            <div className={styles['webhook-card-wrapper']} onClick={() => setModal({ mode: 'view', row: 1 })}>
              <WebhookCard
                repo={"abcd/infra"}
                status={"Active"}
                events={["push"]}
                lastDelivery={"10d"}
                registeredAgo={"63d"}
                branchFilters={['main/*', 'release/*', 'hotfix/*']} />
            </div>

            <div className={styles['webhook-card-wrapper']} onClick={() => setModal({ mode: 'view', row: 2 })}>
              <WebhookCard
                repo={"abcd/api-server"}
                status={"Active"}
                events={["pull_request"]}
                lastDelivery={"10d"}
                registeredAgo={"63d"}
                branchFilters={['hotfix/*']} />
            </div>
          </div>

          <Pagination showing="1-3" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
        </div>
      </main>

      {modal && (
        <WebhookModal
          key={modalKey}
          initialMode={modal.mode}
          {...selectedWebhook}
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
