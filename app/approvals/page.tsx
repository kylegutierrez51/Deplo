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
import { getApprovals, getApprovalStats } from "@/lib/data/approvals";
import { APPROVAL_FILTERS } from "@/lib/filters/options";
import { hasActiveFilters, parseFilters } from "@/lib/filters/parse";
import { Suspense } from "react";

const REFRESH_INTERVAL_MS = 10_000;

type SearchParams = Promise<{ environment?: string; recency?: string; }>;

export default async function Approvals({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams, APPROVAL_FILTERS);
  const filtered = hasActiveFilters(filters, APPROVAL_FILTERS);

  const [approvals, stats] = await Promise.all([getApprovals(filters), getApprovalStats()]);

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

          {approvals.length > 0 || filtered ? (
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

              {approvals.length > 0 ? (
                <>
                  <div className={styles['approvals-layout']}>
                    {approvals.map((a) => (
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
                  <Suspense>
                    <Pagination showing="1-4" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} styles={styles} />
                  </Suspense>
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