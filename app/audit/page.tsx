import styles from "./audit.module.css";
import Sidebar from "@/components/Sidebar/Sidebar";
import Subheader from "@/components/Subheader";
import FiltersBar from "@/components/Filters/FiltersBar"
import FilterSelect from "@/components/Filters/FilterSelect"
import SearchInput from "@/components/Filters/SearchInput"
import Pagination from "@/components/Pagination";

export default function AuditLog() {
  return (
    <>
      <Sidebar activeItem="audit"></Sidebar>

      <main className="page-content">

        <Subheader 
          title="Audit Log"
          subtitle="Immutable record of every action taken across your workspace.">
          <button>
            <ion-icon name="download-outline"></ion-icon>
            Export
          </button>
        </Subheader>

        <FiltersBar>
          <SearchInput
            placeholder={"Search events, users, resources..."} />
          <FilterSelect 
            id={"actions"} name={"actions"} 
            options={
              [
                { value : "all", label: "All actions" },
                { value : "pipeline", label: "Pipeline" },
                { value : "run", label: "Runs" },
                { value : "approval", label: "Approvals" },
                { value : "secret", label: "Secrets" },
                { value : "webhook", label: "Webhooks" },
                { value : "settings", label: "Settings" },
              ]
            }/>
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
            }/>
          <FilterSelect 
            id={"recency"} name={"recency"} 
            options={
              [
                { value : "most-recent", label: "Most recent" },
                { value : "least-recent", label: "Least recent" }
              ]
            }/>
        </FiltersBar>
        
        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <div className={styles['input-group']}>
              <ion-icon name="search-outline"></ion-icon>
              <input type="text" placeholder="Search events, users, resources..." />
            </div>
            <div className={styles['select-group']}>
              <select id="environment" name="environment">
                <option value="all">All actions</option>
                <option value="production">Pipeline</option>
                <option value="staging">Runs</option>
                <option value="development">Approvals</option>
                <option value="preview">Secrets</option>
                <option value="preview">Webhooks</option>
                <option value="preview">Settings</option>
              </select>
            </div>
            <div className={styles['select-group']}>
              <select id="status" name="status">
                <option value="all">All time</option>
                <option value="succeeded">Today</option>
                <option value="failed">Last 7 days</option>
                <option value="running">Last 30 days</option>
                <option value="queued">Last 90 days</option>
              </select>
            </div>
            <div className={styles['select-group']}>
              <select id="recency" name="recency">
                <option value="recent">Most recent</option>
                <option value="production">Least recent</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles['table-wrapper']}>
          <div className={styles['table-border']}>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Run Completed</td>
                  <td>deploy-api #482 <span className={styles['audit-action']}>[PipelineRun]</span></td>
                  <td>system</td>
                  <td className={styles.nowrap}>10d ago</td>
                </tr>
                <tr>
                  <td>Pipeline Triggered</td>
                  <td>deploy-api #482 <span className={styles['audit-action']}>[Pipeline]</span></td>
                  <td>sarah.chen</td>
                  <td className={styles.nowrap}>10d ago</td>
                </tr>
                <tr>
                  <td>Webhook Received</td>
                  <td>push → acme/api-server <span className={styles['audit-action']}>[WebhookEvent]</span></td>
                  <td>github</td>
                  <td className={styles.nowrap}>11d ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}