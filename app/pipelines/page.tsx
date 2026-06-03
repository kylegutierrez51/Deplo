import styles from "./pipelines.module.css"

import Sidebar from "@/components/Sidebar/Sidebar";
import Subheader from "@/components/Subheader";
import FilterSelect from "@/components/Filters/FilterSelect"
import SearchInput from "@/components/Filters/SearchInput"
import Pagination from "@/components/Pagination";

export default function PipelineList() {
  return (
    <>
      <Sidebar activeItem="pipelines"></Sidebar>

      <main className="page-content">
        <Subheader
          title="Pipelines"
          subtitle={<><span id="subtitle-count">8</span> pipelines across your repositories</>}>
          <div className={styles['button-group']}>
            <a href="pipeline-editor.html" className={styles['new-pipeline-btn']}>
              <ion-icon name="add-outline"></ion-icon>
              New Pipeline
            </a>
            <button className={styles['view-drafts-btn']}>
              <ion-icon name="reader-outline"></ion-icon>
              View Drafts
            </button>
          </div>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search pipelines..."} />
            <FilterSelect
              id={"status"} name={"status"}
              options={
                [
                  { value: "all", label: "All statuses" },
                  { value: "queued", label: "Queued" },
                  { value: "running", label: "Running" },
                  { value: "succeeded", label: "Succeeded" },
                  { value: "failed", label: "Failed" },
                  { value: "cancelled", label: "Cancelled" },
                ]
              } />
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
          </div>
        </div>

        <div className={styles['table-wrapper']}>
          <div className={styles['table-border']}>
            <table>
              <thead>
                <tr>
                  <th>Pipeline</th>
                  <th>Repository</th>
                  <th>Environment Type</th>
                  <th>Last Run</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><div className="pill pill--running">Running</div> build-frontend <br /><span className="nowrap">79 runs</span></td>
                  <td>abcd/web-client<br /><span>f4e5d6c feat: add retry logic to webhook...</span></td>
                  <td><div className="pill pill--staging">Staging</div></td>
                  <td className="nowrap">1h ago <br /><span className="nowrap">2m 14s</span></td>
                </tr>
                <tr>
                  <td><div className="pill pill--succeeded">Succeeded</div> deploy-api <br /><span className="nowrap">182 runs</span></td>
                  <td>abcd/api-server<br /><span>a1b2c3d fix: resolve connection pool exh...</span></td>
                  <td><div className="pill pill--production">Production</div></td>
                  <td className="nowrap">1h ago <br /><span className="nowrap">7m 7s</span></td>
                </tr>
                <tr>
                  <td><div className="pill pill--failed">Failed</div> release-mobile <br /><span className="nowrap">68 runs</span></td>
                  <td>abcd/mobile-app<br /><span>7890abc chore: bump dependencies to l...</span></td>
                  <td><div className="pill pill--custom">Custom</div></td>
                  <td className="nowrap">2h ago <br /><span className="nowrap">5m 12s</span></td>
                </tr>
                <tr>
                  <td><div className="pill pill--queued">Queued</div> release-mobile <br /><span className="nowrap">54 runs</span></td>
                  <td>abcd/mobile-app<br /><span>7890abc chore: bump dependencies to l...</span></td>
                  <td><div className="pill pill--preview">Preview</div></td>
                  <td className="nowrap">2h ago <br /><span className="nowrap">5m 12s</span></td>
                </tr>
                <tr>
                  <td><div className="pill pill--cancelled">Cancelled</div> release-mobile <br /><span className="nowrap">22 runs</span></td>
                  <td>abcd/mobile-app<br /><span>7890abc chore: bump dependencies to l...</span></td>
                  <td><div className="pill pill--development">Development</div></td>
                  <td className="nowrap">2h ago <br /><span className="nowrap">5m 12s</span></td>
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
