import type { Metadata } from "next";
import styles from "@/components/ui/resource-list.module.css";
import layoutStyles from "./webhook-events.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import RefreshButton from "@/components/layout/subheader/RefreshButton";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import OverviewStats from "@/components/ui/OverviewStats";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import WebhookEventRow from "@/components/webhook-events/WebhookEventRow";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import WebhookEventModalController from "@/components/webhook-events/WebhookEventModalController";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getWebhookEventsPage, getWebhookEventById } from '@/lib/data/webhook-events';
import { WEBHOOK_EVENT_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';
import { parsePage } from '@/lib/utils/pagination';

const REFRESH_INTERVAL_MS = 15_000;

type SearchParams = Promise<{ mode?: string; id?: string; status?: string; 'event-type'?: string; page?: string; }>;

export const metadata: Metadata = { title: "Events" };

export default async function WebhookEvents({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, WEBHOOK_EVENT_FILTERS);
  const filtered = hasActiveFilters(filters, WEBHOOK_EVENT_FILTERS);

  const webhookEvents = await getWebhookEventsPage(filters, parsePage(params.page));
  const { counts } = webhookEvents;

  const record = id ? await getWebhookEventById(id) : undefined;

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

  return (
    <>
      <Sidebar activeItem="webhook-events" />

      <main className={`page-content ${styles.page} ${layoutStyles['webhook-main']}`}>

        <Subheader
          title="Webhook Events"
          subtitle="Incoming webhook deliveries from GitHub.">
          <RefreshButton />
        </Subheader>
        
        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

        {webhookEvents.total > 0 || filtered ? (
          <>
            <OverviewStats
              ariaLabel="Delivery overview"
              cards={[
                { icon: "time-outline", total: counts.pending, label: "Pending", scope: "All deliveries", tone: "pending" },
                { icon: "checkmark-circle-outline", total: counts.processed, label: "Processed", scope: "All deliveries", tone: "processed" },
                { icon: "remove-circle-outline", total: counts.ignored, label: "Ignored", scope: "All deliveries", tone: "ignored" },
                { icon: "close-circle-outline", total: counts.failed, label: "Failed", scope: "All deliveries", tone: "failed" },
              ]} />

            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput
                  placeholder={"Search repo, branch, commit, pipeline, delivery ID..."}
                  styles={styles} />
                <QueryFilterListbox id={"status"} name={"status"} options={WEBHOOK_EVENT_FILTERS.status} value={filters.status} />
                <QueryFilterListbox id={"event-type"} name={"event-type"} options={WEBHOOK_EVENT_FILTERS['event-type']} value={filters['event-type']} />
                <QueryFilterListbox id={"received"} name={"received"} options={WEBHOOK_EVENT_FILTERS.received} value={filters.received} />
              </div>
            </div>

            {webhookEvents.total > 0 ? (
              <>
                <div className={styles['list-panel']}>
                  <table className={`${styles.table} ${layoutStyles['event-table']}`} aria-label="Webhook events">
                    <thead>
                      <tr>
                        {["Status","Event","Repository","Branch","Commit","Pipeline","Received"].map(column => (
                          <th key={column} scope="col">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {webhookEvents.rows.map((event) => (
                        <WebhookEventRow key={event.id} event={event} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <Pagination page={webhookEvents.page} pageCount={webhookEvents.pageCount} total={webhookEvents.total} pageSize={webhookEvents.pageSize} />
                </div>
              </>
            ) : (
              <EmptyState
                icon="funnel-outline"
                heading="No matching deliveries"
                description="No deliveries match these filters."
                action={{ label: "Clear filters", href: "/webhooks/events" }}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon="pulse-outline"
            heading="No deliveries yet"
            description="GitHub deliveries land here once a registered webhook fires."
            action={{ label: "Manage webhooks", href: "/webhooks" }}
          />
        )}
      </main>

      {modal && (
        <WebhookEventModalController
          mode={modal.mode}
          event={modal.record}
        />
      )}
    </>
  )
}
