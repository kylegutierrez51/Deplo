import styles from "./webhook-events.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import RefreshButton from "@/components/layout/subheader/RefreshButton";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import StatCards from "@/components/ui/StatCards";
import FilterSelect from "@/components/ui/filters/FilterSelect";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import WebhookEventRow from "@/components/webhook-events/WebhookEventRow";
import Pagination from "@/components/ui/pagination/Pagination";
import WebhookEventModalController from "@/components/webhook-events/WebhookEventModalController";
import { getWebhookEvents, getWebhookEventById } from '@/lib/data/webhook-events';


type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function Webhooks({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const { events: webhookEvents, counts } = await getWebhookEvents();

  const record = id ? await getWebhookEventById(id) : undefined;

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

  return (
    <>
      <Sidebar activeItem="webhooks" />

      <main className="page-content">

        <Subheader
          title="Webhook Events"
          subtitle="Incoming webhook deliveries from GitHub.">
          <RefreshButton />
        </Subheader>

        {webhookEvents.length > 0 &&
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
                <FilterSelect
                  id={"status"} name={"status"}
                  styles={styles}
                  options={
                    [
                      { value: "all", label: "All statuses" },
                      { value: "processed", label: "Processed" },
                      { value: "pending", label: "Pending" },
                      { value: "ignored", label: "Ignored" },
                      { value: "failed", label: "Failed" },
                    ]
                  } />
                <FilterSelect
                  id={"event-type"} name={"event-type"}
                  styles={styles}
                  options={
                    [
                      { value: "all", label: "All event types" },
                      { value: "push", label: "Push" },
                      { value: "pull_request", label: "Pull Request" },
                    ]
                  } />
              </div>
            </div>

            <DataTable
              columns={["Status", "Event", "Repository", "Branch", "Commit", "Pipeline", "Received"]}>
              {webhookEvents.map((event, i) => (
                <WebhookEventRow key={i} event={event} />
              ))}
            </DataTable>

            <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
          </>
        }
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
