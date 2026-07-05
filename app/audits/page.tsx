import styles from "./audit.module.css";
import Sidebar from "@/components/sidebar/Sidebar";
import Subheader from "@/components/subheader/Subheader";
import ExportButton from "@/components/subheader/ExportButton";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import AuditRow from "@/components/audits/AuditRow";
import Pagination from "@/components/pagination/Pagination";
import AuditModalController from "@/components/audits/AuditModalController";
import { getAudits, getAuditById } from '@/lib/data/audits';

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function AuditLog({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const audits = await getAudits();

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
            <ExportButton />
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search events, users, resources..."} />
            <FilterSelect
              id={"actions"} name={"actions"}
              options={
                [
                  { value: "all", label: "All actions" },
                  { value: "pipeline", label: "Pipeline" },
                  { value: "run", label: "Runs" },
                  { value: "approval", label: "Approvals" },
                  { value: "secret", label: "Secrets" },
                  { value: "webhook", label: "Webhooks" },
                  { value: "settings", label: "Settings" },
                ]
              } />
            <FilterSelect
              id={"status"} name={"status"}
              options={
                [
                  { value: "all", label: "All time" },
                  { value: "today", label: "Today" },
                  { value: "7days", label: "Last 7 days" },
                  { value: "30days", label: "Last 30 days" },
                  { value: "90days", label: "Last 90 days" },
                ]
              } />
            <FilterSelect
              id={"recency"} name={"recency"}
              options={
                [
                  { value: "most-recent", label: "Most recent" },
                  { value: "least-recent", label: "Least recent" }
                ]
              } />
          </div>
        </div>

        <DataTable
          columns={["Action", "Resource", "Actor", "Time"]}>
          {audits.map((audit, i) => (
            <AuditRow key={i} audit={audit} />
          ))}
        </DataTable>

        <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />

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