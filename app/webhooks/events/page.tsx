import styles from "./webhook-events.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/Sidebar/Sidebar";
import Pagination from "@/components/Pagination";

export default function Webhooks() {
  return (
    <>
      <Sidebar activeItem="webhooks"></Sidebar>

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

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}