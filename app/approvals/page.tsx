import styles from "./approvals.module.css"
import Sidebar from "@/components/Sidebar/Sidebar";
import Subheader from "@/components/Subheader";
import Pagination from "@/components/Pagination";

export default function Approvals() {
  return (
    <>
      <Sidebar activeItem="approvals"></Sidebar>

      <main className="page-content">
        <div className="page-layout">


          <Subheader 
            title="Approvals"
            subtitle="Pipeline runs waiting for manual approval before proceeding.">
          </Subheader>

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
                    <div className="pill pill--production">Production</div>
                    <div className="pill pill--manual">Manual</div>
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
                    <div className="pill pill--development">Development</div>
                    <div className="pill pill--manual">Manual</div>
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

          <Pagination showing="1-3 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} styles={styles} />
        </div>
      </main>
    </>
  )
}