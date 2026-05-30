import styles from "./run-history.module.css";
import Subheader from "@/components/Subheader";

export default function RunHistory() {
  return (
    <>
      <aside className={styles.sidebar}>

        <nav className={styles['sidebar-nav']} aria-label="Main">
          <div className={styles['sidebar-content']}>
            <span className={styles.subtitle}>DEPLOY</span>
            <ul>
              <li>
                <ion-icon name="git-network-outline"></ion-icon>
                <a href="pipeline-list.html">
                  <span className={styles.title}>Pipelines</span>
                </a>
              </li>
              <li>
                <ion-icon name="time-outline"></ion-icon>
                <a href="run-history.html">
                  <span className={styles.title}>Run History</span>
                </a>
              </li>
              <li>
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                <a href="approvals.html">
                  <span className={styles.title}>Approvals</span>
                </a>
              </li>
            </ul>
          </div>

          <div className={styles['sidebar-content']}>
            <span className={styles.subtitle}>MANAGE</span>
            <ul>
              <li>
                <ion-icon name="key-outline"></ion-icon>
                <a href="secrets.html">
                  <span className={styles.title}>Secrets</span>
                </a>
              </li>
              <li>
                <ion-icon name="settings-outline"></ion-icon>
                <a href="environments.html">
                  <span className={styles.title}>Environments</span>
                </a>
              </li>
              <li>
                <ion-icon name="flash-outline"></ion-icon>
                <a href="webhooks.html">
                  <span className={styles.title}>Webhooks</span>
                </a>
              </li>
              <li>
                <ion-icon name="reader-outline"></ion-icon>
                <a href="audit-log.html">
                  <span className={styles.title}>Audit Log</span>
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <div className={styles.profile}>
          <div className={styles['profile-pic']}></div>
          <div className={styles['profile-details']}>
            <div className={styles.user}>
              <div className={styles.name}>Coco</div>
              <div className={styles.role}>ADMIN</div>
            </div>
            <ion-icon name="chevron-up-outline"></ion-icon>
          </div>
        </div>

      </aside>

      <div className={styles['profile-options']}>
        <div className={styles['profile-menu']}>
          <div className={styles['profile-view']}>Profile</div>
          <div className={styles['sign-out']}>Sign Out</div>
        </div>
      </div>

      <button className={styles['sidebar-toggle']} id="sidebarToggle">
        <ion-icon name="menu-outline"></ion-icon>
      </button>

      <main className={styles['page-content']}>

        <Subheader 
          title="Run History"
          subtitle="All pipeline executions across your projects."
          badge={{ count: 3, label: 'Active'}}>
          <button>
            <ion-icon name="caret-forward-outline"></ion-icon>
            Run Pipeline
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <div className={styles['input-group']}>
              <ion-icon name="search-outline"></ion-icon>
              <input type="text" placeholder="Search pipelines, commits..." />
            </div>
            <div className={styles['select-group']}>
              <select id="status" name="status">
                <option value="all">All statuses</option>
                <option value="succeeded">Queued</option>
                <option value="failed">Running</option>
                <option value="running">Succeeded</option>
                <option value="queued">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className={styles['select-group']}>
              <select id="trigger" name="trigger">
                <option value="all">All triggers</option>
                <option value="production">Webhook</option>
                <option value="staging">Manual</option>
                <option value="development">API</option>
              </select>
            </div>
            <div className={styles['select-group']}>
              <select id="environment" name="environment">
                <option value="all">All environment types</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
                <option value="preview">Preview</option>
                <option value="preview">Custom</option>
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
                  <th>Pipeline</th>
                  <th>Environment Type</th>
                  <th>Trigger</th>
                  <th>Duration</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
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
