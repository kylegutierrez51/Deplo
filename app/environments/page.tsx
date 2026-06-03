import styles from './env.module.css';
import Sidebar from "@/components/Sidebar/Sidebar"
import Subheader from "@/components/Subheader";
import StatCards from '@/components/Cards/StatCards';
import FiltersBar from "@/components/Filters/FiltersBar"
import FilterSelect from "@/components/Filters/FilterSelect"
import SearchInput from "@/components/Filters/SearchInput"
import Pagination from '@/components/Pagination';

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

        <StatCards
          cards={
            [
              { icon: "settings-outline", total: 5, label: "ENVIRONMENTS" },
              { icon: "key-outline", total: 5, label: "TOTAL SECRETS" },
              { icon: "shield-outline", total: 1, label: "PROTECTED" },
              { icon: "git-branch-outline", total: 11, label: "PIPELINE BINDINGS" },
            ]
          }>
        </StatCards>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search environments..."} />
            <FilterSelect
              id={"environment"} name={"environment"}
              options={
                [
                  { value: "all", label: "All environment types" },
                  { value: "production", label: "Production" },
                  { value: "staging", label: "Staging" },
                  { value: "development", label: "Development" },
                  { value: "preview", label: "Preview" },
                  { value: "custom", label: "Custom" },
                ]
              } />
            <FilterSelect
              id={"status"} name={"status"}
              options={
                [
                  { value: "all", label: "All time" },
                  { value: "today", label: "Today" },
                  { value: "7days", label: "Last 7 days" },
                  { value: "30days", label: "Last 30 days" },
                  { value: "90days", label: "Last 90 days" },
                ]
              } />
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

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}