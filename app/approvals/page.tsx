import styles from "./approvals.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import Subheader from "@/components/layout/subheader/Subheader";
import StatCards from "@/components/ui/StatCards";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import ApprovalCard from "@/components/approvals/ApprovalCard";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getApprovalsPage, getApprovalStats } from "@/lib/data/approvals";
import { APPROVAL_FILTERS } from "@/lib/filters/options";
import { hasActiveFilters, parseFilters } from "@/lib/filters/parse";
import { parsePage } from "@/lib/utils/pagination";

const REFRESH_INTERVAL_MS = 10_000;
const PAGE_SIZE = 6;

type SearchParams = Promise<{ environment?: string; recency?: string; page?: string; }>;

export default async function Approvals({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params, APPROVAL_FILTERS);
  const filtered = hasActiveFilters(filters, APPROVAL_FILTERS);

  const [approvals, stats] = await Promise.all([getApprovalsPage(filters, parsePage(params.page), PAGE_SIZE), getApprovalStats()]);

  return (
    <>
      <Sidebar activeItem="approvals" />

      <main className="page-content">
        <div className="page-layout">

          <Subheader
            title="Approvals"
            subtitle="Pipeline runs waiting for manual approval before proceeding."
          />

          {/* always re-render Approvals page every 10s to detect if approval stages are present, otherwise user will have to refresh page to see new approval stages */}
          <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

          {approvals.total > 0 || filtered ? (
            <>
              <StatCards
                cards={
                  [
                    { icon: "alert-circle-outline", total: stats.pending, label: "PENDING" },
                    { icon: "alert-circle-outline", total: stats.production, label: "PRODUCTION" },
                    { icon: "stopwatch-outline", total: stats.longestWait, label: "LONGEST WAIT", valueClassName: "wait-time" },
                  ]
                }
                responsive={false}
              />

              <div className={styles.filters}>
                <div className={styles['filters-bar']}>
                  <SearchInput
                    placeholder={"Search by pipeline, repo, branch, user..."}
                    styles={styles} />
                  <QueryFilterListbox id={"environment"} name={"environment"} styles={styles} options={APPROVAL_FILTERS.environment} value={filters.environment} />
                  <QueryFilterListbox id={"recency"} name={"recency"} styles={styles} options={APPROVAL_FILTERS.recency} value={filters.recency} />
                </div>
              </div>

              {approvals.total > 0 ? (
                <>
                  <div className={styles['approvals-layout']}>
                    {approvals.rows.map((a) => (
                      <div key={a.id} className={styles['approval-card-wrapper']}>
                        <ApprovalCard
                          id={a.id}
                          runNumber={a.runNumber ?? null}
                          stageId={a.stageId}
                          runId={a.runId}
                          pipelineName={a.pipelineName}
                          stageName={a.stageName}
                          environment={a.environment}
                          commitSha={a.commitSha}
                          commitMessage={a.commitMessage}
                          createdBy={a.createdBy}
                          branch={a.branch}
                          waitingTime={a.waitingTime}
                          stagesComplete={a.stagesComplete}
                        />
                      </div>
                    ))}
                  </div>
                  <Pagination page={approvals.page} pageCount={approvals.pageCount} total={approvals.total} pageSize={approvals.pageSize}  />
                </>
              ) : (
                <EmptyState
                  icon="funnel-outline"
                  heading="No matching approvals"
                  description="No waiting approvals match these filters."
                  action={{ label: "Clear filters", href: "/approvals" }}
                />
              )}
            </>
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              heading="Nothing is waiting on you"
              description="Runs pause here when they reach an approval stage."
            />
          )}
        </div>
      </main>
    </>
  )
}