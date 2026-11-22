import type { Metadata } from "next";
import styles from "@/components/ui/resource-list.module.css";
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

export const metadata: Metadata = { title: "Approvals" };

export default async function Approvals({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params, APPROVAL_FILTERS);
  const filtered = hasActiveFilters(filters, APPROVAL_FILTERS);

  const [approvals, stats] = await Promise.all([getApprovalsPage(filters, parsePage(params.page), PAGE_SIZE), getApprovalStats()]);

  return (
    <>
      <Sidebar activeItem="approvals" />

      <main className={`page-content ${styles.page}`}>

        <Subheader
          title="Approvals"
          subtitle="Pipeline runs waiting for manual approval before proceeding."
        />

        {/* always re-render Approvals page every 10s to detect if approval stages are present, otherwise user will have to refresh page to see new approval stages */}
        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

        {approvals.total > 0 || filtered ? (
          <>
            <StatCards
              ariaLabel="Approval overview"
              cards={[
                { icon: "shield-outline", total: stats.pending, label: "Pending", scope: "Waiting for a decision", tone: "approval" },
                { icon: "server-outline", total: stats.production, label: "Production", scope: "Pending in production", tone: "running" },
                { icon: "stopwatch-outline", total: stats.longestWait, label: "Longest wait", scope: "Across pending approvals", tone: "approval" },
              ]}
            />

            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput
                  placeholder={"Search by pipeline, repo, branch, user..."}
                  styles={styles} />
                <QueryFilterListbox id={"environment"} name={"environment"} options={APPROVAL_FILTERS.environment} value={filters.environment} />
                <QueryFilterListbox id={"recency"} name={"recency"} options={APPROVAL_FILTERS.recency} value={filters.recency} />
              </div>
            </div>

            {approvals.total > 0 ? (
              <>
                <section className={styles['list-panel']} aria-label="Pending approvals">
                  {approvals.rows.map(approval => <ApprovalCard key={approval.id} {...approval} />)}
                </section>
                <div className={styles.pagination}>
                  <Pagination page={approvals.page} pageCount={approvals.pageCount} total={approvals.total} pageSize={approvals.pageSize} />
                </div>
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
      </main>
    </>
  )
}