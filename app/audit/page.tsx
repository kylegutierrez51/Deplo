import styles from "./audit.module.css";
import Sidebar from "@/components/Sidebar/Sidebar";
import Subheader from "@/components/Subheader";


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

        <div className={styles['page-view']}>
          <div className={styles.pages}>
            Showing 1-10 of 20
          </div>

          <div className={styles['pagination-container']}>
            <div className={styles['pagination-row']}>
              <div className={styles['view-option']}>
                <ion-icon name="chevron-back-outline"></ion-icon>
                <div>Prev</div>
              </div>

              <div className={styles['page-numbers']}>
                <div className={styles['page-number']}>1</div>
                <div className={styles['page-number']}>...</div>
                <div className={styles['page-number']}>8</div>
                <div className={styles['page-number']}><span>9</span></div>
                <div className={styles['page-number']}>10</div>
                <div className={styles['page-number']}>...</div>
                <div className={styles['page-number']}>22</div>
              </div>

              <div className={styles['view-option']}>
                <div>Next</div>
                <ion-icon name="chevron-forward-outline"></ion-icon>
              </div>

            </div>
          </div>
        </div>

      </main>
    </>
  )
}