import styles from './env.module.css';
import Sidebar from "@/components/Sidebar/Sidebar"
import Subheader from "@/components/Subheader";


export default function Environments() {
  return (
    <>
      <Sidebar activeItem="environments"></Sidebar>

      <main className="page-content">

        <Subheader 
          title="Environments"
          subtitle="Manage deploy targets and their secret scoping.">
          <button>
            <ion-icon name="add-outline"></ion-icon>
            Create Environment
          </button>
        </Subheader>

        <div className={styles.cards}>
          <div className={styles['cards-row']}>
            <div className={styles.card}>
              <ion-icon name="settings-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={styles['card-total']}>5</span>
                <span className={styles['card-name']}>ENVIRONMENTS</span>
              </div>
            </div>
            <div className={styles.card}>
              <ion-icon name="key-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={styles['card-total']}>5</span>
                <span className={styles['card-name']}>TOTAL SECRETS</span>
              </div>
            </div>
            <div className={styles.card}>
              <ion-icon name="shield-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={styles['card-total']}>1</span>
                <span className={styles['card-name']}>PROTECTED</span>
              </div>
            </div>
            <div className={styles.card}>
              <ion-icon name="git-branch-outline"></ion-icon>
              <div className={styles['card-detail']}>
                <span className={styles['card-total']}>11</span>
                <span className={styles['card-name']}>PIPELINE BINDINGS</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <div className={styles['input-group']}>
              <ion-icon name="search-outline"></ion-icon>
              <input type="text" placeholder="Search environments..." />
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
              <select id="status" name="status">
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles['table-wrapper']}>
          <div className={styles['table-border']}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Environment Type</th>
                  <th>Secrets</th>
                  <th>Pipelines</th>
                  <th>Last Updated</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.filter}>
                    <div>production</div>
                    <ion-icon name="lock-closed-outline"></ion-icon>
                  </td>
                  <td><div className="pill pill--development">Development</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="key-outline"></ion-icon>
                    <div>14</div>
                  </td>
                  <td>6</td>
                  <td>4d ago</td>
                  <td>coco</td>
                </tr>
                <tr>
                  <td className={styles.filter}>
                    <div>staging</div>
                  </td>
                  <td><div className="pill pill--staging">Staging</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="key-outline"></ion-icon>
                    <div>12</div>
                  </td>
                  <td>2</td>
                  <td>4d ago</td>
                  <td>coco</td>
                </tr>
                <tr>
                  <td className={styles.filter}>
                    <div>development</div>
                  </td>
                  <td><div className="pill pill--production">Production</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="key-outline"></ion-icon>
                    <div>8</div>
                  </td>
                  <td>3</td>
                  <td>8d ago</td>
                  <td>coco</td>
                </tr>
                <tr>
                  <td className={styles.filter}>
                    <div>development</div>
                  </td>
                  <td><div className="pill pill--preview">Preview</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="key-outline"></ion-icon>
                    <div>8</div>
                  </td>
                  <td>3</td>
                  <td>8d ago</td>
                  <td>coco</td>
                </tr>
                <tr>
                  <td className={styles.filter}>
                    <div>development</div>
                  </td>
                  <td><div className="pill pill--custom">Custom</div></td>
                  <td className={styles.filter}>
                    <ion-icon name="key-outline"></ion-icon>
                    <div>8</div>
                  </td>
                  <td>3</td>
                  <td>8d ago</td>
                  <td>coco</td>
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