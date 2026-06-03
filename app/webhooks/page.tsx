import styles from "./webhooks.module.css"
import Subheader from "@/components/Subheader"
import Sidebar from "@/components/Sidebar/Sidebar"
import FilterSelect from "@/components/Filters/FilterSelect"
import SearchInput from "@/components/Filters/SearchInput"
import Pagination from "@/components/Pagination"


export default function Webhooks() {
  return (
    <>
      <Sidebar activeItem="webhooks"></Sidebar>

      <main className="page-content">
        <div className="page-layout">

          <Subheader
            title="GitHub Webhooks"
            subtitle="Register webhooks to automatically trigger pipelines on push or pull request events.">
            <button>
              <ion-icon name="add-outline"></ion-icon>
              Add Webhook
            </button>
          </Subheader>

          <div className={styles.filters}>
            <div className={styles['filters-bar']}>


              <SearchInput placeholder={"Search webhooks..."} />
              <FilterSelect
                id={"active"} name={"active"}
                options={
                  [
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" }
                  ]
                } />
              <FilterSelect
                id={"recency"} name={"recency"}
                options={
                  [
                    { value: "most-recent", label: "Most recently registered" },
                    { value: "least-recent", label: "Least recently registered" }
                  ]
                } />
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
                  <option value="most-recent">Most recently registered</option>
                  <option value="least-recent">Least recently registered</option>
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

          <Pagination showing="1-5 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} styles={styles} />
        </div>
      </main>
    </>
  )
}