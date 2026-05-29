import sidebarStyles from "@/styles/sidebar.module.css";
import subheaderStyles from "@/styles/subheader.module.css";
import cardStyles from "@/styles/cards.module.css";
import filterStyles from "@/styles/filters.module.css";
import approvalStyles from "@/styles/approvals.module.css"
import paginationStyles from "@/styles/pagination.module.css";
import approvalMediaStyles from "@/styles/media/approvals.module.css";

const styles = {
  ...sidebarStyles,
  ...subheaderStyles,
  ...cardStyles,
  ...filterStyles,
  ...approvalStyles,
  ...paginationStyles,
  ...approvalMediaStyles,
};



export default function Approvals() {
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
                <h1>Approvals</h1>
                <p className={styles['subtitle']}>Pipeline runs waiting for manual approval before proceeding.</p>
              </div>
            </div>
          </div>

          <div className={styles.cards}>
            <div className={styles['cards-row']}>
              <div className={styles.card}>
                <ion-icon name="alert-circle-outline"></ion-icon>
                <div className={styles['card-detail']}>
                  <span className={styles['card-total']}>4</span>
                  <span className={styles['card-name']}>PENDING</span>
                </div>
              </div>
              <div className={styles.card}>
                <ion-icon name="alert-circle-outline"></ion-icon>
                <div className={styles['card-detail']}>
                  <span className={styles['card-total']}>3</span>
                  <span className={styles['card-name']}>PRODUCTION</span>
                </div>
              </div>
              <div className={styles.card}>
                <ion-icon name="stopwatch-outline"></ion-icon>
                <div className={styles['card-detail']}>
                  <span className={`${styles['wait-time']} ${styles['card-total']}`}>18h 17m</span>
                  <span className={styles['card-name']}>LONGEST WAIT</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.filters}>
            <div className={styles['filters-bar']}>
              <div className={`${styles['input-group']} ${styles['approvals-input-group']}`}>
                <ion-icon name="search-outline"></ion-icon>
                <input className={styles['approvals-input']} type="text" placeholder="Search by pipeline, repo, branch, user..." />
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
                  <option value="oldest">Oldest first</option>
                  <option value="newest">Newest first</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles['approvals-layout']}>
            <div className={styles['approval-card']}>
              <div className={styles['approval-card-row']}>
                <div className={styles['approvals-detail']}>
                  <div className={styles['pipeline-name-type']}>
                    <span>release-mobile</span>
                    <div className={`${styles.pill} ${styles['pill--production']}`}>Production</div>
                    <div className={`${styles.pill} ${styles['pill--manual']}`}>Manual</div>
                  </div>
                  <div className={styles['feature-info']}>
                    <div className={styles['feature-id']}>
                      <ion-icon name="git-commit-outline"></ion-icon>
                      <span>c3d4e5f</span>
                    </div>
                    <span className={styles.feature}>fix: resolve deep link crash on Android 14</span>
                  </div>
                  <div className={styles['extra-info']}>
                    <div className={styles['meta-row']}>
                      <ion-icon name="person-outline"></ion-icon>
                      <span>alex.kim</span>
                    </div>
                    <div className={styles['meta-row']}>
                      <ion-icon name="git-branch-outline"></ion-icon>
                      <span>main</span>
                    </div>
                    <div className={styles['meta-row']}>
                      <ion-icon name="stopwatch-outline"></ion-icon>
                      <span>Waiting <span className={styles['waiting-time']}>18h 17m</span></span>
                    </div>
                    <div className={styles['meta-row']}>
                      <ion-icon name="caret-forward-outline"></ion-icon>
                      <span>6/8 stages complete</span>
                    </div>
                  </div>
                </div>
                <div className={styles['btn-group']}>
                  <a href="run-detail.html" className={styles['view-run-btn']}>
                    <ion-icon name="open-outline"></ion-icon>
                    View Run
                  </a>
                  <button className={styles['reject-btn']}>
                    <ion-icon name="close-circle-outline"></ion-icon>
                    Reject
                  </button>
                  <button className={styles['approve-btn']}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    Approve
                  </button>
                </div>
                <div className={styles['stage-view']}>
                  <div>
                    <ion-icon name="chevron-down-outline"></ion-icon>
                    <span>Hide stages</span>
                  </div>
                </div>
              </div>
              <div className={styles.stages}>
                <div className={styles['stages-row']}>
                  <div className={styles.stage}>
                    <ion-icon name="cube-outline"></ion-icon>
                    <span>install-deps</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="cube-outline"></ion-icon>
                    <span>lint</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="flask-outline"></ion-icon>
                    <span>unit-tests</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={`${styles.stage} ${styles['approval']}`}>
                    <ion-icon name="shield-outline"></ion-icon>
                    <span>release-approval</span>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="rocket-outline"></ion-icon>
                    <span>publish-stores</span>
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="rocket-outline"></ion-icon>
                    <span>publish-stores</span>
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="rocket-outline"></ion-icon>
                    <span>publish-stores</span>
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles['approval-card']}>
              <div className={styles['approval-card-row']}>
                <div className={styles['approvals-detail']}>
                  <div className={styles['pipeline-name-type']}>
                    <span>release-mobile</span>
                    <div className={`${styles.pill} ${styles['pill--development']}`}>Development</div>
                    <div className={`${styles.pill} ${styles['pill--manual']}`}>Manual</div>
                  </div>
                  <div className={styles['feature-info']}>
                    <div className={styles['feature-id']}>
                      <ion-icon name="git-commit-outline"></ion-icon>
                      <span>c3d4e5f</span>
                    </div>
                    <span className={styles.feature}>fix: resolve deep link crash on Android 14</span>
                  </div>
                  <div className={styles['extra-info']}>
                    <div className={styles['meta-row']}>
                      <ion-icon name="person-outline"></ion-icon>
                      <span>alex.kim</span>
                    </div>
                    <div className={styles['meta-row']}>
                      <ion-icon name="git-branch-outline"></ion-icon>
                      <span>main</span>
                    </div>
                    <div className={styles['meta-row']}>
                      <ion-icon name="stopwatch-outline"></ion-icon>
                      <span>Waiting <span className={styles['waiting-time']}>18h 17m</span></span>
                    </div>
                    <div className={styles['meta-row']}>
                      <ion-icon name="caret-forward-outline"></ion-icon>
                      <span>6/8 stages complete</span>
                    </div>
                  </div>
                </div>
                <div className={styles['btn-group']}>
                  <a href="run-detail.html" className={styles['view-run-btn']}>
                    <ion-icon name="open-outline"></ion-icon>
                    View Run
                  </a>
                  <button className={styles['reject-btn']}>
                    <ion-icon name="close-circle-outline"></ion-icon>
                    Reject
                  </button>
                  <button className={styles['approve-btn']}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    Approve
                  </button>
                </div>
                <div className={styles['stage-view']}>
                  <div>
                    <ion-icon name="chevron-down-outline"></ion-icon>
                    <span>Hide stages</span>
                  </div>
                </div>
              </div>
              <div className={styles.stages}>
                <div className={styles['stages-row']}>
                  <div className={styles.stage}>
                    <ion-icon name="cube-outline"></ion-icon>
                    <span>install-deps</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="cube-outline"></ion-icon>
                    <span>lint</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="flask-outline"></ion-icon>
                    <span>unit-tests</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={`${styles.stage} ${styles['approval']}`}>
                    <ion-icon name="shield-outline"></ion-icon>
                    <span>release-approval</span>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="rocket-outline"></ion-icon>
                    <span>publish-stores</span>
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="rocket-outline"></ion-icon>
                    <span>publish-stores</span>
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                  <span>→</span>
                  <div className={styles.stage}>
                    <ion-icon name="rocket-outline"></ion-icon>
                    <span>publish-stores</span>
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles['page-view']}>
            <div className={styles.pages}>
              Showing 1-3 of 20
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