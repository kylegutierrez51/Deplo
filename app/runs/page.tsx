import type { Metadata } from "next";
import styles from "@/components/ui/resource-list.module.css";
import layoutStyles from "./runs.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import RefreshButton from "@/components/layout/subheader/RefreshButton";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import RunRow from "@/components/runs/RunRow";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import RunModalController from "@/components/runs/RunModalController";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getRunsPage, getRunById, countActiveRuns } from "@/lib/data/runs";
import { RUN_FILTERS } from "@/lib/filters/options";
import { hasActiveFilters, parseFilters } from "@/lib/filters/parse";
import { parsePage } from "@/lib/utils/pagination";
import { redirect } from 'next/navigation';

const REFRESH_INTERVAL_MS = 10_000;

type SearchParams = Promise<{ mode?: string; id?: string; status?: string; trigger?: string; environment?: string; recency?: string; page?: string; }>;

export const metadata: Metadata = { title: "Runs" };

export default async function RunHistory({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, RUN_FILTERS);
  const filtered = hasActiveFilters(filters, RUN_FILTERS);

  const [runs, activeRuns] = await Promise.all([getRunsPage(filters, parsePage(params.page)), countActiveRuns()]);

  const record = id ? await getRunById(id) : undefined;

  // edge case where a run (or parent pipeline) gets deleted while the user is viewing it
  if (id && !record && mode !== "create") redirect("/runs");

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

  return (
    <>
      <Sidebar activeItem="run-history" />

      <main className={`page-content ${styles.page}`}>

        <Subheader
          title="Run History"
          subtitle="All pipeline executions across your projects."
          badge={activeRuns > 0 ? { count: activeRuns, label: 'Active' } : undefined}>
          <RefreshButton />
        </Subheader>

        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

        {runs.total > 0 || filtered ? (
          <>
            <div className={`${styles.filters} ${layoutStyles['run-filters']}`}>
              <div className={styles['filters-bar']}>
                <SearchInput
                  placeholder={"Search pipelines, commits..."} styles={styles} />
                <QueryFilterListbox id={"status"} name={"status"} options={RUN_FILTERS.status} value={filters.status} />
                <QueryFilterListbox id={"trigger"} name={"trigger"} options={RUN_FILTERS.trigger} value={filters.trigger} />
                <QueryFilterListbox id={"environment"} name={"environment"} options={RUN_FILTERS.environment} value={filters.environment} />
                <QueryFilterListbox id={"recency"} name={"recency"} options={RUN_FILTERS.recency} value={filters.recency} />
              </div>
            </div>

            {runs.total > 0 ? (
              <>
                <div className={styles['list-panel']}>
                  <table className={`${styles.table} ${layoutStyles['run-table']}`} aria-label="Run history">
                    <thead>
                      <tr>
                        {['Pipeline', 'Environment', 'Trigger', 'Duration', 'Created at'].map(column => (
                          <th key={column} scope="col">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runs.rows.map((run) => (
                        <RunRow key={run.id} run={run} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={`${styles.pagination} ${layoutStyles['run-pagination']}`}>
                  <Pagination page={runs.page} pageCount={runs.pageCount} total={runs.total} pageSize={runs.pageSize} />
                </div>
              </>
            ) : (
              <EmptyState
                icon="funnel-outline"
                heading="No matching runs"
                description="No runs match these filters."
                action={{ label: "Clear filters", href: "/runs" }}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon="time-outline"
            heading="No runs yet"
            description="Runs appear here when a pipeline is triggered, by you or by a webhook."
            action={{ label: "Go to pipelines", href: "/pipelines" }}
          />
        )}
      </main>

      {modal && (
        <RunModalController
          mode={modal.mode}
          run={modal.record}
        />
      )}
    </>
  )
}
