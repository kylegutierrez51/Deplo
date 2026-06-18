import styles from "./webhooks.module.css"
import Subheader from "@/components/subheader/Subheader"
import AddButton from '@/components/subheader/AddButton';
import Sidebar from "@/components/sidebar/Sidebar"
import FilterSelect from "@/components/filters/FilterSelect"
import SearchInput from "@/components/filters/SearchInput";
import WebhookCardShell from "@/components/webhooks/WebhookCardShell";
import WebhookCard from "@/components/webhooks/card/WebhookCard";
import Pagination from "@/components/Pagination"
import WebhookModalController from '@/components/webhooks/WebhookModalController';
import { getWebhooks, getWebhookById } from "@/lib/data/webhooks";

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function Webhooks({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const webhooks = await getWebhooks();

  const record = id ? await getWebhookById(Number(id)) : undefined;

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

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
            {webhooks.map((webhook, i) => (
              <WebhookCardShell key={i} id={webhook.id}>
                <WebhookCard
                  id={webhook.id}
                  repo={webhook.repository}
                  status={webhook.status}
                  events={webhook.events}
                  lastDelivery={webhook.lastDelivery}
                  registeredAgo={webhook.registeredAgo}
                  branchFilters={webhook.branchFilters} />
              </WebhookCardShell>
            ))}
          </div>

          <Pagination showing="1-3" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
        </div>
      </main>

      {modal && (
        <WebhookModalController
          mode={modal.mode}
          webhook={modal.record}
        />
      )}
    </>
  )
}
