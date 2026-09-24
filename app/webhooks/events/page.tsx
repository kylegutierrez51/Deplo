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
import { getWebhookEvents, getWebhookEventById } from '@/lib/data/webhook-events';
import { WEBHOOK_EVENT_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';

const REFRESH_INTERVAL_MS = 15_000;

type SearchParams = Promise<{ mode?: string; id?: string; status?: string; 'event-type'?: string; }>;

export default async function WebhookEvents({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, WEBHOOK_EVENT_FILTERS);
  const filtered = hasActiveFilters(filters, WEBHOOK_EVENT_FILTERS);

  const { events: webhookEvents, counts } = await getWebhookEvents(filters);

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

        {webhookEvents.length > 0 || filtered ? (
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
              </div>
            </div>

            {webhookEvents.length > 0 ? (
              <>
                <DataTable
                  columns={["Status", "Event", "Repository", "Branch", "Commit", "Pipeline", "Received"]}>
                  {webhookEvents.map((event) => (
                    <WebhookEventRow key={event.id} event={event} />
                  ))}
                </DataTable>

                <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
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
