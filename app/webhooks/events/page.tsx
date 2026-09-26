import styles from "./webhook-events.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import RefreshButton from "@/components/layout/subheader/RefreshButton";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import StatCards from "@/components/ui/StatCards";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
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

      <main className={`page-content ${styles['webhook-main']}`}>

        <Subheader
          title="Webhook Events"
          subtitle="Incoming webhook deliveries from GitHub.">
          <RefreshButton />
        </Subheader>
        
        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

        {webhookEvents.total > 0 || filtered ? (
          <>
            <StatCards
              cards={
                [
                  { icon: "time-outline", total: counts.pending, label: "PENDING", valueClassName: 'pending' },
                  { icon: "checkmark-circle-outline", total: counts.processed, label: "PROCESSED", valueClassName: 'processed' },
                  { icon: "remove-circle-outline", total: counts.ignored, label: "IGNORED", valueClassName: 'ignored' },
                  { icon: "close-circle-outline", total: counts.failed, label: "FAILED", valueClassName: 'failed' },
                ]
              } />

            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput
                  placeholder={"Search repo, branch, commit, pipeline, delivery ID..."}
                  styles={styles} />
                <QueryFilterListbox id={"status"} name={"status"} styles={styles} options={WEBHOOK_EVENT_FILTERS.status} value={filters.status} />
                <QueryFilterListbox id={"event-type"} name={"event-type"} styles={styles} options={WEBHOOK_EVENT_FILTERS['event-type']} value={filters['event-type']} />
                <QueryFilterListbox id={"received"} name={"received"} styles={styles} options={WEBHOOK_EVENT_FILTERS.received} value={filters.received} />
              </div>
            </div>

            {webhookEvents.total > 0 ? (
              <>
                <DataTable
                  columns={["Status", "Event", "Repository", "Branch", "Commit", "Pipeline", "Received"]}>
                  {webhookEvents.rows.map((event) => (
                    <WebhookEventRow key={event.id} event={event} />
                  ))}
                </DataTable>

                <Pagination page={webhookEvents.page} pageCount={webhookEvents.pageCount} total={webhookEvents.total} pageSize={webhookEvents.pageSize} />
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
