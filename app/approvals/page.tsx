import styles from "./approvals.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import Subheader from "@/components/layout/subheader/Subheader";
import StatCards from "@/components/ui/StatCards";
import FilterListbox from "@/components/ui/filters/FilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import ApprovalCard from "@/components/approvals/ApprovalCard";
import Pagination from "@/components/ui/pagination/Pagination";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getApprovals } from "@/lib/data/approvals";
import { Suspense } from "react";

const REFRESH_INTERVAL_MS = 10_000;

export default async function Approvals() {
  const approvals = await getApprovals();

  const totalPending = approvals.length;
  const totalProduction = approvals.filter((a) => a.environment?.type === 'production').length;
  const longestWait = approvals[0]?.waitingTime ?? '0m';

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

          {approvals.length > 0 &&
            <>
              <StatCards
                cards={
                  [
                    { icon: "alert-circle-outline", total: totalPending, label: "PENDING" },
                    { icon: "alert-circle-outline", total: totalProduction, label: "PRODUCTION" },
                    { icon: "stopwatch-outline", total: longestWait, label: "LONGEST WAIT", valueClassName: "wait-time" },
                  ]
                }
                responsive={false}
              />

              <div className={styles.filters}>
                <div className={styles['filters-bar']}>
                  <SearchInput
                    placeholder={"Search by pipeline, repo, branch, user..."}
                    styles={styles} />
                  <FilterListbox
                    id={"environment"} name={"environment"}
                    styles={styles}
                    options={
                      [
                        { value: "all", label: "All environment types" },
                        { value: "production", label: "Production" },
                        { value: "staging", label: "Staging" },
                        { value: "development", label: "Development" },
                        { value: "preview", label: "Preview" },
                        { value: "custom", label: "Custom" },
                      ]
                    } />
                  <FilterListbox
                    id={"recency"} name={"recency"}
                    styles={styles}
                    options={
                      [
                        { value: "most-recent", label: "Most recent" },
                        { value: "least-recent", label: "Least recent" }
                      ]
                    } />
                </div>
              </div>

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
          }
        </div>
      </main>
    </>
  )
}