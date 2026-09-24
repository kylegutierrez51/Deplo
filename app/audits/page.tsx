import styles from "./audit.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import Subheader from "@/components/layout/subheader/Subheader";
import RefreshButton from "@/components/layout/subheader/RefreshButton";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import AuditRow from "@/components/audits/AuditRow";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import AuditModalController from "@/components/audits/AuditModalController";
import AutoRefresh from "@/components/ui/AutoRefresh";
import { getAudits, getAuditById } from '@/lib/data/audits';
import { AUDIT_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';

const REFRESH_INTERVAL_MS = 30_000;

type SearchParams = Promise<{ mode?: string; id?: string; resource?: string; range?: string; recency?: string; }>;

export default async function AuditLog({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, AUDIT_FILTERS);
  const filtered = hasActiveFilters(filters, AUDIT_FILTERS);

  const audits = await getAudits(filters);

  const record = id ? await getAuditById(id) : undefined;

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;


  return (
    <>
      <Sidebar activeItem="audit" />

      <main className="page-content">

        <Subheader
          title="Audit Log"
          subtitle="Immutable record of every action taken across your workspace.">
          <RefreshButton />
        </Subheader>

        <AutoRefresh intervalMs={REFRESH_INTERVAL_MS} />

        {audits.length > 0 || filtered ? (
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput
                  placeholder={"Search events, users, resources..."} />
                <QueryFilterListbox id={"resource"} name={"resource"} options={AUDIT_FILTERS.resource} value={filters.resource} />
                <QueryFilterListbox id={"range"} name={"range"} options={AUDIT_FILTERS.range} value={filters.range} />
                <QueryFilterListbox id={"recency"} name={"recency"} options={AUDIT_FILTERS.recency} value={filters.recency} />
              </div>
            </div>

            {audits.length > 0 ? (
              <>
                <DataTable
                  columns={["Action", "Resource", "Actor", "Time", ""]}>
                  {audits.map((audit) => (
                    <AuditRow key={audit.id} audit={audit} />
                  ))}
                </DataTable>

                <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
              </>
            ) : (
              <EmptyState
                icon="funnel-outline"
                heading="No matching entries"
                description="No audit entries match these filters."
                action={{ label: "Clear filters", href: "/audits" }}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon="reader-outline"
            heading="Nothing recorded yet"
            description="Every create, edit, delete and approval decision is logged here."
          />
        )}
      </main>

      {modal && (
        <AuditModalController
          mode={modal.mode}
          audit={modal.record}
        />
      )}
    </>
  )
}