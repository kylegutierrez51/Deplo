import styles from "./webhooks.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from '@/components/layout/subheader/AddButton';
import SubheaderLink from '@/components/layout/subheader/SubheaderLink';
import Sidebar from "@/components/layout/sidebar/Sidebar";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import WebhookCardShell from "@/components/webhooks/WebhookCardShell";
import WebhookCard from "@/components/webhooks/WebhookCard";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import WebhookModalController from '@/components/webhooks/WebhookModalController';
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getWebhooksPage, getWebhookById } from "@/lib/data/webhooks";
import { getPipelines } from "@/lib/data/pipelines";
import { redirect } from 'next/navigation';
import { WEBHOOK_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';
import { parsePage } from '@/lib/utils/pagination';

const REFRESH_INTERVAL_MS = 15_000;
const PAGE_SIZE = 4;

type SearchParams = Promise<{ mode?: string; id?: string; active?: string; recency?: string; page?: string; }>;

export default async function Webhooks({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, WEBHOOK_FILTERS);
  const filtered = hasActiveFilters(filters, WEBHOOK_FILTERS);

  const webhooks = await getWebhooksPage(filters, parsePage(params.page), PAGE_SIZE);
  const pipelines = await getPipelines();

  const record = id ? await getWebhookById(id) : undefined;

  // edge case where a webhook gets deleted in one tab while the user is editing or viewing it in another tab
  if (id && !record && mode !== "create") redirect("/webhooks");

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
            <SubheaderLink href="/webhooks/events" icon="pulse-outline" text="View Events" />
            <AddButton text={"Add Webhook"} url={"webhooks"} />
          </Subheader>

          <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

          {webhooks.total > 0 || filtered ? (
            <>
              <div className={styles.filters}>
                <div className={styles['filters-bar']}>
                  <SearchInput placeholder={"Search webhooks..."} />
                  <QueryFilterListbox id={"active"} name={"active"} options={WEBHOOK_FILTERS.active} value={filters.active} />
                  <QueryFilterListbox id={"recency"} name={"recency"} options={WEBHOOK_FILTERS.recency} value={filters.recency} />
                </div>
              </div>

              {webhooks.total > 0 ? (
                <>
                  <div className={styles['webhook-layout']}>
                    {webhooks.rows.map((webhook) => (
                      <WebhookCardShell key={webhook.id} id={webhook.id}>
                        <WebhookCard
                          webhook={webhook} />
                      </WebhookCardShell>
                    ))}
                  </div>

                  <Pagination page={webhooks.page} pageCount={webhooks.pageCount} total={webhooks.total} pageSize={webhooks.pageSize} />
                </>
              ) : (
                <EmptyState
                  icon="funnel-outline"
                  heading="No matching webhooks"
                  description="No webhooks match these filters."
                  action={{ label: "Clear filters", href: "/webhooks" }}
                />
              )}
            </>
          ) : (
            <EmptyState
              icon="flash-outline"
              heading="No webhooks yet"
              description="Register a webhook to trigger a pipeline on every push or pull request."
              action={{ label: "Add Webhook", href: "/webhooks?mode=create", icon: "add-outline" }}
            />
          )}
        </div>
      </main>

      {modal && (
        <WebhookModalController
          mode={modal.mode}
          webhook={modal.record}
          pipelines={pipelines}
        />
      )}
    </>
  )
}
