import styles from "./run-history.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/Sidebar/Sidebar";
import FilterSelect from "@/components/Filters/FilterSelect";
import SearchInput from "@/components/Filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";

export default function RunHistory() {
  return (
    <>
      <Sidebar activeItem="run-history"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Run History"
          subtitle="All pipeline executions across your projects."
          badge={{ count: 3, label: 'Active' }}>
          <button>
            <ion-icon name="caret-forward-outline"></ion-icon>
            Run Pipeline
          </button>
        </Subheader>

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
          columns={["Pipeline", "Environment Type", "Trigger", "Duration", "Time"]}>
          <tr>
            <td><div className="pill pill--queued">Queued</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v12</td>
            <td><div className="pill pill--production">Production</div></td>
            <td><div className="pill pill--webhook">Webhook</div></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">-</div>
            </td>
            <td className="nowrap">6h ago</td>
          </tr>
          <tr>
            <td><div className="pill pill--running">Running</div> build-frontend <br /><span>acbcd/web-client</span> &bull; v8</td>
            <td><div className="pill pill--staging">Staging</div></td>
            <td><div className="pill pill--manual">Manual</div></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">6h 1m</div>
            </td>
            <td className="nowrap">6h ago</td>
          </tr>
          <tr>
            <td><div className="pill pill--succeeded">Succeeded</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
            <td><div className="pill pill--development">Development</div></td>
            <td><div className="pill pill--api">API</div></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">8m 0s</div>
            </td>
            <td className="nowrap">11h ago</td>
          </tr>
          <tr>
            <td><div className="pill pill--failed">Failed</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
            <td><div className="pill pill--preview">Preview</div></td>
            <td><div className="pill pill--webhook">Webhook</div></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">8m 0s</div>
            </td>
            <td className="nowrap">11h ago</td>
          </tr>
          <tr>
            <td><div className="pill pill--cancelled">Cancelled</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
            <td><div className="pill pill--custom">Custom</div></td>
            <td><div className="pill pill--manual">Manual</div></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">8m 0s</div>
            </td>
            <td className="nowrap">11h ago</td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}
