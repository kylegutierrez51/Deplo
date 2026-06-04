import styles from "./secrets.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/Sidebar/Sidebar";
import FilterSelect from "@/components/Filters/FilterSelect";
import SearchInput from "@/components/Filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";

export default function Secrets() {
  return (
    <>
      <Sidebar activeItem="secrets"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Secrets"
          subtitle="Encrypted environment variables injected into pipeline stages at runtime.">
          <button>
            <ion-icon name="add-outline"></ion-icon>
            Add Secret
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Filter by key or notes..."} />
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
        
        <DataTable
          columns={["Key", "Value", "Environment Type", "Updated", "Created By"]}>
          <tr>
            <td>DATABASE_URL<br /><span>Primary Postgres connection -- pool...</span></td>
            <td className={styles.filter}>
              <div>••••••••••••••••••••••••</div>
              <ion-icon name="eye-outline"></ion-icon>
              <ion-icon name="copy-outline"></ion-icon>
            </td>
            <td><div className="pill pill--production">Production</div></td>
            <td className="nowrap">11d ago</td>
            <td>sarah.chen</td>
          </tr>
          <tr>
            <td>DATABASE_URL<br /></td>
            <td className={styles.filter}>
              <div>••••••••••••••••••••••••</div>
              <ion-icon name="eye-outline"></ion-icon>
              <ion-icon name="copy-outline"></ion-icon>
            </td>
            <td><div className="pill pill--staging">Staging</div></td>
            <td className="nowrap">13d ago</td>
            <td>sarah.chen</td>
          </tr>
          <tr>
            <td>GITHUB_TOKEN<br /><span>Fine-grained PAT scoped to acme or...</span></td>
            <td className={styles.filter}>
              <div>••••••••••••••••••••••••</div>
              <ion-icon name="eye-outline"></ion-icon>
              <ion-icon name="copy-outline"></ion-icon>
            </td>
            <td><div className="pill pill--development">Development</div></td>
            <td className="nowrap">12d ago <br /><span className="nowrap">5m 12s</span></td>
            <td>marcus.coco</td>
          </tr>
          <tr>
            <td>GITHUB_TOKEN<br /><span>Fine-grained PAT scoped to acme or...</span></td>
            <td className={styles.filter}>
              <div>••••••••••••••••••••••••</div>
              <ion-icon name="eye-outline"></ion-icon>
              <ion-icon name="copy-outline"></ion-icon>
            </td>
            <td><div className="pill pill--preview">Preview</div></td>
            <td className="nowrap">12d ago <br /><span className="nowrap">5m 12s</span></td>
            <td>marcus.coco</td>
          </tr>
          <tr>
            <td>GITHUB_TOKEN<br /><span>Fine-grained PAT scoped to acme or...</span></td>
            <td className={styles.filter}>
              <div>••••••••••••••••••••••••</div>
              <ion-icon name="eye-outline"></ion-icon>
              <ion-icon name="copy-outline"></ion-icon>
            </td>
            <td><div className="pill pill--custom">Custom</div></td>
            <td className="nowrap">12d ago <br /><span className="nowrap">5m 12s</span></td>
            <td>marcus.coco</td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}