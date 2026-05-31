import styles from "./webhook-events.module.css";
import Subheader from "@/components/Subheader";

export default function Webhooks() {
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

      <main className="page-content">

        <Subheader 
          title="Webhook Events"
          subtitle="Incoming webhook deliveries from GitHub.">
          <button>
            <ion-icon name="refresh-outline"></ion-icon>
            Refresh
          </button>
        </Subheader>

        <div className={styles.cards}>
          <div className={styles['cards-row']}>
            <div className={styles.card}>
              <ion-icon name="flash-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={styles['card-total']}>7</span>
                <span className={styles['card-name']}>TOTAL EVENTS</span>
              </div>
            </div>
            <div className={styles.card}>
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={`${styles['card-total']} ${styles['processed']}`}>3</span>
                <span className={styles['card-name']}>PROCESSED</span>
              </div>
            </div>
            <div className={styles.card}>
              <ion-icon name="remove-circle-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={`${styles['card-total']} ${styles['ignored']}`}>2</span> {/*-- only color this gray if it's >= 1 */}
                <span className={styles['card-name']}>IGNORED</span>
              </div>
            </div>
            <div className={styles.card}>
              <ion-icon name="close-circle-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={`${styles['card-total']} ${styles['failed']}`}>2</span> {/* only color this red if it's >= 1 */}
                <span className={styles['card-name']}>FAILED</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <div className={styles['webhook-event-input-group']}>
              <ion-icon name="search-outline"></ion-icon>
              <input type="text" placeholder="Search repo, branch, commit, pipeline, delivery ID..." />
            </div>
            <div className={styles['select-group']}>
              <select id="status" name="status">
                <option value="all">All statuses</option>
                <option value="succeeded">Processed</option>
                <option value="failed">Ignored</option>
                <option value="running">Failed</option>
              </select>
            </div>
            <div className={styles['select-group']}>
              <select id="event-type" name="event-type">
                <option value="all">All event types</option>
                <option value="today">push</option>
                <option value="7days">pull_request</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles['table-wrapper']}>
          <div className={styles['table-border']}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Event</th>
                  <th>Repository</th>
                  <th>Branch</th>
                  <th>Commit</th>
                  <th>Pipeline</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><div className="pill pill--processed">Processed</div></td>
                  <td><div className="pill pill--push">push</div></td>
                  <td>abcd/api-server</td>
                  <td>main</td>
                  <td>a1b2c3d<br/><span>feat: add retry logic to webhook...</span></td>
                  <td>deploy-api</td>
                  <td>1h ago</td>
                </tr>
                <tr>
                  <td><div className="pill pill--ignored">Ignored</div></td>
                  <td><div className="pill pill--push">push</div></td>
                  <td>abcd/web-client</td>
                  <td>release/v2.4.0</td>
                  <td>f4e5d6c<br/><span>feat: chore: bump dependencies to l...</span></td>
                  <td>build-frontend</td>
                  <td>2h ago</td>
                </tr>
                <tr>
                  <td><div className="pill pill--failed">Failed</div></td>
                  <td><div className="pill pill--pull-request">pull_request</div></td>
                  <td>abcd/web-client</td>
                  <td>feature/auth-flow</td>
                  <td>7890abc<br/><span>feat: add user role migration for...</span></td>
                  <td>db-migrate</td>
                  <td>3h ago</td>
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