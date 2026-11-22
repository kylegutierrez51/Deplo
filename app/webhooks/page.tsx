import type { Metadata } from "next";
import styles from "@/components/ui/resource-list.module.css";
import layoutStyles from "./webhooks.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from '@/components/layout/subheader/AddButton';
import SubheaderLink from '@/components/layout/subheader/SubheaderLink';
import Sidebar from "@/components/layout/sidebar/Sidebar";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import WebhookRow from "@/components/webhooks/WebhookRow";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import WebhookModalController from '@/components/webhooks/WebhookModalController';
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getWebhooksPage, getWebhookById } from "@/lib/data/webhooks";
import { getPipelines } from "@/lib/data/pipelines";
import { getEnvironments } from "@/lib/data/environments";
import { redirect } from 'next/navigation';
import { WEBHOOK_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';
import { parsePage } from '@/lib/utils/pagination';
import { readPublicUrl } from '@/lib/webhooks/endpoint';

const REFRESH_INTERVAL_MS = 15_000;

let warnedPublicUrl = false;

// returns null if DEPLO_PUBLIC_URL is not set
function publicUrlFromEnv(): string | null {
  const raw = process.env.DEPLO_PUBLIC_URL;
  const url = readPublicUrl(raw);
  if (raw?.trim() && !url && !warnedPublicUrl) {
    warnedPublicUrl = true;
    console.warn('DEPLO_PUBLIC_URL is not an http(s) URL; ignoring it');
  }
  return url;
}

type SearchParams = Promise<{ mode?: string; id?: string; active?: string; recency?: string; page?: string; }>;

export const metadata: Metadata = { title: "Webhooks" };

export default async function Webhooks({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, WEBHOOK_FILTERS);
  const filtered = hasActiveFilters(filters, WEBHOOK_FILTERS);

  const webhooks = await getWebhooksPage(filters, parsePage(params.page));
  const pipelines = await getPipelines();
  const environments = await getEnvironments();

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

      <main className={`page-content ${styles.page}`}>

        <div className={layoutStyles.header}>
          <Subheader
            title="GitHub Webhooks"
            subtitle="Register webhooks to automatically trigger pipelines on push or pull request events.">
            <SubheaderLink href="/webhooks/events" icon="pulse-outline" text="View Events" />
            <AddButton text={"Add Webhook"} url={"webhooks"} />
          </Subheader>
        </div>

        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

        {webhooks.total > 0 || filtered ? (
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Search webhooks..."} styles={styles} />
                <QueryFilterListbox id={"active"} name={"active"} options={WEBHOOK_FILTERS.active} value={filters.active} />
                <QueryFilterListbox id={"recency"} name={"recency"} options={WEBHOOK_FILTERS.recency} value={filters.recency} />
              </div>
            </div>

            {webhooks.total > 0 ? (
              <>
                <div className={styles['list-panel']}>
                  <table className={`${styles.table} ${layoutStyles['webhook-table']}`} aria-label="Webhooks">
                    <thead>
                      <tr>
                        {['Pipeline', 'Status', 'Events', 'Environment', 'Last delivery'].map(column => (
                          <th key={column} scope="col">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {webhooks.rows.map(webhook => <WebhookRow key={webhook.id} webhook={webhook} />)}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <Pagination page={webhooks.page} pageCount={webhooks.pageCount} total={webhooks.total} pageSize={webhooks.pageSize} />
                </div>
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
      </main>

      {modal && (
        <WebhookModalController
          mode={modal.mode}
          webhook={modal.record}
          pipelines={pipelines}
          environments={environments}
          publicUrl={publicUrlFromEnv()}
        />
      )}
    </>
  )
}
