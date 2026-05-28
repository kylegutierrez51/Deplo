import sidebarStyles from "@/styles/sidebar.module.css";
import runDetailStyles from "@/styles/run-detail.module.css";
import filterStyles from "@/styles/filters.module.css";
import runDetailMediaStyles from "@/styles/media/run-detail.module.css";

const styles = {
  ...sidebarStyles,
  ...runDetailStyles,
  ...filterStyles,
  ...runDetailMediaStyles,
};



export default function RunDetail() {
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

      <div className={styles.topbar}>
        <button className={styles['sidebar-toggle']} id="sidebarToggle">
          <ion-icon name="menu-outline"></ion-icon>
        </button>
        <a href="run-history.html" className={styles['back-link']}>
          <ion-icon name="arrow-back-outline"></ion-icon>
          Run History
        </a>
      </div>


      <main className={styles['page-content']}>
        <div className={styles['page-layout']}>

          <section className={styles['run-detail-card']}>
            <div className={styles['rdc-inner']}>

              <div className={styles['rdc-info']}>
                {/* Row 1: name, run number, status, environment */}
                <div className={styles['rdc-title-row']}>
                  <span className={styles['rdc-name']}>deploy-api</span>
                  <span className={styles['rdc-num']}>#47</span>
                  <div className={`${styles['rdc-status']} ${styles.running} ${styles.pill} ${styles['pill--running']}`}>
                    <ion-icon name="sync-outline"></ion-icon>
                    Running
                  </div>
                  <div className={`${styles.pill} ${styles['pill--production']}`}>Production</div>
                </div>

                {/* Row 2: commit info */}
                <div className={styles['rdc-commit-row']}>
                  <div className={styles['rdc-commit-ref']}>
                    <ion-icon name="git-commit-outline"></ion-icon>
                    <span className={styles['rdc-commit-hash']}>a1b2c3d</span>
                  </div>
                  <span className={styles['rdc-commit-msg']}>fix: resolve connection pool e...</span> {/*30 chars should fit */}
                  <div className={styles['rdc-meta-item']}>
                    <ion-icon name="git-branch-outline"></ion-icon>
                    <span>main</span>
                  </div>
                  <div className={`${styles['rdc-meta-item']} ${styles['rdc-link']}`}>
                    <ion-icon name="open-outline"></ion-icon>
                    <span>acme/api-server</span>
                  </div>
                </div>

                {/* Row 3: trigger info */}
                <div className={styles['rdc-trigger-row']}>
                  <div className={styles['rdc-meta-item']}>
                    <ion-icon name="flash-outline"></ion-icon>
                    <span>Triggered by webhook <span className={styles['rdc-user']}>(sarah.chen)</span></span>
                  </div>
                  <div className={styles['rdc-meta-item']}>
                    <ion-icon name="stopwatch-outline"></ion-icon>
                    <span>7m 12s</span>
                  </div>
                  <div className={styles['rdc-meta-item']}>
                    <ion-icon name="time-outline"></ion-icon>
                    <span>7m ago</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className={styles['rdc-actions']}>
                <button className={styles['rdc-btn-cancel']}>
                  <ion-icon name="ban-outline"></ion-icon>
                  Cancel Run
                </button>
                <button className={styles['rdc-btn-rerun']}>
                  <ion-icon name="refresh-outline"></ion-icon>
                  Re-run
                </button>
              </div>

            </div>
          </section>

          <div className={styles.sections}>
            <div className={styles['tabs-row']}>
              <button className={`${styles.section} ${styles['active']}`} data-section="overview">
                <ion-icon name="layers-outline"></ion-icon>
                <span>Overview</span>
              </button>
              <button className={styles.section} data-section="logs">
                <ion-icon name="receipt-outline"></ion-icon>
                <span>Logs</span>
              </button>
            </div>
          </div>

          <section className={styles.overview} id="section-overview">
            <div className={styles['job-statuses']}>
              <div className={`${styles.pill} ${styles['pill--total']}`}>8 Total</div>
              <div className={`${styles.pill} ${styles['pill--succeeded']}`}>4 Succeeded</div>
              <div className={`${styles.pill} ${styles['pill--running']}`}>1 Running</div>
              <div className={`${styles.pill} ${styles['pill--queued']}`}>3 Queued</div>
              <div className={`${styles.pill} ${styles['pill--failed']}`}> 0 Failed</div>
              <div className={`${styles.pill} ${styles['pill--approval']}`}>0 Awaiting Approval</div>
            </div>

            <div className={styles.pipeline}>
              <div className={styles['pipeline-inner']}>

                {/* install-deps */}
                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>install-deps</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className={`${styles.pill} ${styles['pill--succeeded']}`}>Succeeded</div>
                    <span>42s</span>
                  </div>
                </div>

                {/* Fork: install-deps → lint + unit-tests */}
                <div className={styles['connector-fork']}>
                  <div className={styles['cf-stem']}></div>
                  <div className={styles['cf-arms']}>
                    <div className={styles['cf-spacer']}></div>
                    <div className={`${styles['cf-arm']} ${styles['cf-arm-left']}`}></div>
                    <div className={`${styles['cf-arm']} ${styles['cf-arm-right']}`}></div>
                    <div className={styles['cf-spacer']}></div>
                  </div>
                </div>

                {/* Parallel: lint + unit-tests */}
                <div className={styles['parallel-row']}>
                  <div className={styles.job}>
                    <div className={styles['job-name']}>
                      <span>lint</span>
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </div>
                    <div className={styles['job-status-time']}>
                      <div className={`${styles.pill} ${styles['pill--succeeded']}`}>Succeeded</div>
                      <span>38s</span>
                    </div>
                  </div>
                  <div className={styles.job}>
                    <div className={styles['job-name']}>
                      <span>unit-tests</span>
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </div>
                    <div className={styles['job-status-time']}>
                      <div className={`${styles.pill} ${styles['pill--succeeded']}`}>Succeeded</div>
                      <span>2m 13s</span>
                    </div>
                  </div>
                </div>

                {/* Merge: lint + unit-tests → build */}
                <div className={styles['connector-merge']}>
                  <div className={styles['cm-arms']}>
                    <div className={styles['cm-spacer']}></div>
                    <div className={`${styles['cm-arm']} ${styles['cm-arm-left']}`}></div>
                    <div className={`${styles['cm-arm']} ${styles['cm-arm-right']}`}></div>
                    <div className={styles['cm-spacer']}></div>
                  </div>
                  <div className={styles['cm-stem']}></div>
                </div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>build</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className={`${styles.pill} ${styles['pill--succeeded']}`}>Succeeded</div>
                    <span>1m 25s</span>
                  </div>
                </div>

                {/* Connector: build → deploy-staging (active) */}
                <div className={`${styles['connector-straight']} ${styles.active}`}></div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>deploy-staging</span>
                    <ion-icon name="sync-outline" className={styles['job-icon-running']}></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className={`${styles.pill} ${styles['pill--running']}`}>Running</div>
                    <span>24m 4s</span>
                  </div>
                </div>

                {/* Connector: deploy-staging → smoke-tests */}
                <div className={styles['connector-straight']}></div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>smoke-tests</span>
                    <ion-icon name="time-outline" className={styles['job-icon-pending']}></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className={`${styles.pill} ${styles['pill--queued']}`}>Queued</div>
                  </div>
                </div>

                {/* Connector: smoke-tests → manual-approval */}
                <div className={styles['connector-straight']}></div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>manual-approval</span>
                    <ion-icon name="time-outline" className={styles['job-icon-pending']}></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className={`${styles.pill} ${styles['pill--queued']}`}>Queued</div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          <section className={styles.logs} id="section-logs" style={{ display: "none" }}>

            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <div className={styles['select-group']}>
                  <select id="status" name="status">
                    <option value="all">install deps - succeeded</option>
                    <option value="succeeded">lint - succeeded</option>
                    <option value="failed">unit-tests - succeeded</option>
                    <option value="running">build - succeeded</option>
                    <option value="queued">deploy-staging - running</option>
                    <option value="cancelled">smoke-tests - pending</option>
                    <option value="cancelled">manual-approval - pending</option>
                    <option value="cancelled">deploy-production - pending</option>
                  </select>
                </div>
                <div className={styles['input-group']}>
                  <ion-icon name="search-outline"></ion-icon>
                  <input type="text" placeholder="Search logs..." />
                </div>
              </div>
            </div>


            <div className={styles['log-viewer']}>

              <div className={styles['log-header']}>
                <div className={styles['log-header-left']}>
                  <ion-icon name="checkmark-circle-outline" className={`${styles['log-job-icon']} ${styles.succeeded}`}></ion-icon>
                  <span className={styles['log-job-name']}>install-deps</span>
                  <span className={styles['log-job-cmd']}>npm ci --production=false</span>
                </div>
                <span className={styles['log-duration']}>42s</span>
              </div>

              <div className={styles['log-body']}>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>1</span>
                  <span className={styles['log-time']}>00:00.0</span>
                  <span className={styles['log-content']}><span className={styles['log-prompt']}>$</span> npm ci --production=false</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>2</span>
                  <span className={styles['log-time']}>00:00.3</span>
                  <span className={`${styles['log-content']} ${styles['log-warn']}`}>npm warn deprecated inflight@1.0.6: This module is not supported</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>3</span>
                  <span className={styles['log-time']}>00:02.1</span>
                  <span className={styles['log-content']}>added 1,247 packages in 38s</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>4</span>
                  <span className={styles['log-time']}>00:02.2</span>
                  <span className={styles['log-content']}>182 packages are looking for funding</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>5</span>
                  <span className={styles['log-time']}>00:42.0</span>
                  <span className={`${styles['log-content']} ${styles['log-success']}`}>&#10003; Dependencies installed successfully</span>
                </div>
              </div>

              <div className={styles['log-footer']}>
                <span>Process exited with code 0</span>
              </div>

            </div>
          </section>

        </div>
      </main>
    </>
  )
}
