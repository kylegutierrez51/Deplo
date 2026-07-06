import styles from "./runs.module.css";
import Subheader from "@/components/subheader/Subheader";
import Sidebar from "@/components/sidebar/Sidebar";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import RunRow from "@/components/runs/RunRow";
import Pagination from "@/components/pagination/Pagination";
import RunModalController from "@/components/runs/RunModalController";
import { getRuns, getRunById } from "@/lib/data/runs";

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function RunHistory({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id, } = await searchParams;
  const runs = await getRuns();

  const record = id ? await getRunById(id) : undefined;

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

  return (
    <>
      <Sidebar activeItem="run-history" />

      <main className="page-content">

        <Subheader
          title="Run History"
          subtitle="All pipeline executions across your projects."
          badge={{ count: 3, label: 'Active' }}>
        </Subheader>

        {runs.length > 0 &&
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput
                  placeholder={"Search pipelines, commits..."} />
                <FilterSelect
                  id={"status"} name={"status"}
                  options={
                    [
                      { value: "all", label: "All statuses" },
                      { value: "queued", label: "Queued" },
                      { value: "running", label: "Running" },
                      { value: "succeeded", label: "Succeeded" },
                      { value: "failed", label: "Failed" },
                      { value: "cancelled", label: "Cancelled" },
                    ]
                  } />
                <FilterSelect
                  id={"trigger"} name={"trigger"}
                  options={
                    [
                      { value: "all", label: "All triggers" },
                      { value: "webhook", label: "Webhook" },
                      { value: "manual", label: "Manual" },
                      { value: "api", label: "API" },
                    ]
                  } />
                <FilterSelect
                  id={"environment"} name={"environment"}
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
              columns={["Pipeline", "Environment", "Trigger", "Duration", "Created At"]}>
              {runs.map((run, i) => (
                <RunRow key={i} run={run} />
              ))}
            </DataTable>

            <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
          </>
        }
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
