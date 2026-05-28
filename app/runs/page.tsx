import sidebarStyles from "@/styles/sidebar.module.css";
import subheaderStyles from "@/styles/subheader.module.css";
import filterStyles from "@/styles/filters.module.css";
import tableStyles from "@/styles/table.module.css";
import paginationStyles from "@/styles/pagination.module.css";
import pipelineListMediaStyles from "@/styles/media/pipeline-list.module.css";

const styles = {
  ...sidebarStyles,
  ...subheaderStyles,
  ...filterStyles,
  ...tableStyles,
  ...paginationStyles,
  ...pipelineListMediaStyles,
};



export default function runHistory() {
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

        <div className={styles.subheader}>
          <div className={styles['subheader-inner']}>
            <div className={styles['title-group']}>
              <div className={styles['title-row']}>
                <h1>Run History</h1>
                <div className={styles['active-badge']}>
                  <span className={styles['active-dot']}></span>
                  <span>3 active</span>
                </div>
              </div>
              <p className={styles['subtitle']}>All pipeline executions across your projects.</p>
            </div>
            <button>
              <ion-icon name="caret-forward-outline"></ion-icon>
              Run Pipeline
            </button>
          </div>
        </div>

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
                  <td><div className={`${styles.pill} ${styles['pill--queued']}`}>Queued</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v12</td>
                  <td><div className={`${styles.pill} ${styles['pill--production']}`}>Production</div></td>
                  <td><div className={`${styles.pill} ${styles['pill--webhook']}`}>Webhook</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="stopwatch-outline"></ion-icon>
                    <div className={styles.nowrap}>-</div>
                  </td>
                  <td className={styles.nowrap}>6h ago</td>
                </tr>
                <tr>
                  <td><div className={`${styles.pill} ${styles['pill--running']}`}>Running</div> build-frontend <br /><span>acbcd/web-client</span> &bull; v8</td>
                  <td><div className={`${styles.pill} ${styles['pill--staging']}`}>Staging</div></td>
                  <td><div className={`${styles.pill} ${styles['pill--manual']}`}>Manual</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="stopwatch-outline"></ion-icon>
                    <div className={styles.nowrap}>6h 1m</div>
                  </td>
                  <td className={styles.nowrap}>6h ago</td>
                </tr>
                <tr>
                  <td><div className={`${styles.pill} ${styles['pill--succeeded']}`}>Succeeded</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
                  <td><div className={`${styles.pill} ${styles['pill--development']}`}>Development</div></td>
                  <td><div className={`${styles.pill} ${styles['pill--api']}`}>API</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="stopwatch-outline"></ion-icon>
                    <div className={styles.nowrap}>8m 0s</div>
                  </td>
                  <td className={styles.nowrap}>11h ago</td>
                </tr>
                <tr>
                  <td><div className={`${styles.pill} ${styles['pill--failed']}`}>Failed</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
                  <td><div className={`${styles.pill} ${styles['pill--preview']}`}>Preview</div></td>
                  <td><div className={`${styles.pill} ${styles['pill--webhook']}`}>Webhook</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="stopwatch-outline"></ion-icon>
                    <div className={styles.nowrap}>8m 0s</div>
                  </td>
                  <td className={styles.nowrap}>11h ago</td>
                </tr>
                <tr>
                  <td><div className={`${styles.pill} ${styles['pill--cancelled']}`}>Cancelled</div> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
                  <td><div className={`${styles.pill} ${styles['pill--custom']}`}>Custom</div></td>
                  <td><div className={`${styles.pill} ${styles['pill--manual']}`}>Manual</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="stopwatch-outline"></ion-icon>
                    <div className={styles.nowrap}>8m 0s</div>
                  </td>
                  <td className={styles.nowrap}>11h ago</td>
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
