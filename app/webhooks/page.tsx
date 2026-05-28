import sidebarStyles from "@/styles/sidebar.module.css";
import subheaderStyles from "@/styles/subheader.module.css";
import filterStyles from "@/styles/filters.module.css";
import webhookStyles from "@/styles/webhooks.module.css";
import paginationStyles from "@/styles/pagination.module.css";
import webhookMediaStyles from "@/styles/media/webhooks.module.css";

const styles = {
  ...sidebarStyles,
  ...subheaderStyles,
  ...filterStyles,
  ...webhookStyles,
  ...paginationStyles,
  ...webhookMediaStyles,
};



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

      <main className={styles['page-content']}>
        <div className={styles['page-layout']}>
          <div className={styles.subheader}>
            <div className={styles['subheader-inner']}>
              <div className={styles['title-group']}>
                <h1>GitHub Webhooks</h1>
                <p className={styles['subtitle']}>Register webhooks to automatically trigger pipelines on push or pull request events.</p>
              </div>
              <button>
                <ion-icon name="add-outline"></ion-icon>
                Add Webhook
              </button>
            </div>
          </div>

          <div className={styles.filters}>
            <div className={styles['filters-bar']}>
              <div className={styles['input-group']}>
                <ion-icon name="search-outline"></ion-icon>
                <input type="text" placeholder="Search webhooks..." />
              </div>
              <div className={styles['select-group']}>
                <select id="active" name="active">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className={styles['select-group']}>
                <select id="recency" name="recency">
                  <option value="recent">Most recently registered</option>
                  <option value="production">Least recently registered</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles['webhook-layout']}>
            <div className={styles['webhook-container']}>
              <div className={styles['webhook-row']}>
                <div className={styles['webhook-detail']}>
                  <div className={styles['git-icon']}>
                    <ion-icon name="git-branch-outline"></ion-icon>
                  </div>
                  <div className={styles['pipeline-info']}>
                    <div className={styles['name-status']}>
                      <div className={styles.name}>abcd/infra</div>
                      <div className={styles.inactive}>Inactive</div>
                    </div>
                    <div className={styles.events}>
                      <div className={styles['event-type']}>push</div>
                    </div>
                    <div className={styles.secret}>
                      <span>Secret:</span>
                      <span className={styles['secret-val']}>whsec_••••••••••••••••</span>
                      <ion-icon name="eye-outline"></ion-icon>
                      <ion-icon name="copy-outline"></ion-icon>
                    </div>
                    <div className={styles.time}>
                      <div className={styles['last-delivery']}>
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                        <span>10d ago</span>
                      </div>
                      <span>&bull;</span>
                      <span className={styles.registered}>Registered 63d ago</span>
                    </div>
                  </div>
                </div>
                <div className={styles.options}>
                  <ion-icon name="sync-outline"></ion-icon>
                  <ion-icon name="trash-outline"></ion-icon>
                </div>
              </div>
            </div>

            <div className={styles['webhook-container']}>
              <div className={styles['webhook-row']}>
                <div className={styles['webhook-detail']}>
                  <div className={styles['git-icon']}>
                    <ion-icon name="git-branch-outline"></ion-icon>
                  </div>
                  <div className={styles['pipeline-info']}>
                    <div className={styles['name-status']}>
                      <div className={styles.name}>abcd/api-server</div>
                      <div className={styles.active}>Active</div>
                    </div>
                    <div className={styles.events}>
                      <div className={styles['event-type']}>pull_request</div>
                    </div>
                    <div className={styles.secret}>
                      <span>Secret:</span>
                      <span className={styles['secret-val']}>whsec_••••••••••••••••</span>
                      <ion-icon name="eye-outline"></ion-icon>
                      <ion-icon name="copy-outline"></ion-icon>
                    </div>
                    <div className={styles.time}>
                      <div className={styles['last-delivery']}>
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                        <span>10d ago</span>
                      </div>
                      <span>&bull;</span>
                      <span className={styles.registered}>Registered 63d ago</span>
                    </div>
                  </div>
                </div>
                <div className={styles.options}>
                  <ion-icon name="sync-outline"></ion-icon>
                  <ion-icon name="trash-outline"></ion-icon>
                </div>
              </div>
            </div>


            <div className={styles['webhook-container']}>
              <div className={styles['webhook-row']}>
                <div className={styles['webhook-detail']}>
                  <div className={styles['git-icon']}>
                    <ion-icon name="git-branch-outline"></ion-icon>
                  </div>
                  <div className={styles['pipeline-info']}>
                    <div className={styles['name-status']}>
                      <div className={styles.name}>abcd/api-server</div>
                      <div className={styles.active}>Active</div>
                    </div>
                    <div className={styles.events}>
                      <div className={styles['event-type']}>push</div>
                      <div className={styles['event-type']}>pull_request</div>
                    </div>
                    <div className={styles.secret}>
                      <span>Secret:</span>
                      <span className={styles['secret-val']}>whsec_••••••••••••••••</span>
                      <ion-icon name="eye-outline"></ion-icon>
                      <ion-icon name="copy-outline"></ion-icon>
                    </div>
                    <div className={styles.time}>
                      <div className={styles['last-delivery']}>
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                        <span>10d ago</span>
                      </div>
                      <span>&bull;</span>
                      <span className={styles.registered}>Registered 63d ago</span>
                    </div>
                  </div>
                </div>
                <div className={styles.options}>
                  <ion-icon name="sync-outline"></ion-icon>
                  <ion-icon name="trash-outline"></ion-icon>
                </div>
              </div>
            </div>
          </div>

          <div className={styles['page-view']}>
            <div className={styles.pages}>
              Showing 1-5 of 20
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
        </div>
      </main>
    </>
  )
}