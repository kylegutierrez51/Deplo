import styles from './env.module.css';
import Sidebar from "@/components/Sidebar/Sidebar"
import Subheader from "@/components/Subheader";
import StatCards from '@/components/Cards/StatCards';
import FilterSelect from "@/components/Filters/FilterSelect";
import SearchInput from "@/components/Filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from '@/components/Pagination';
import Pill from '@/components/Pill';

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

        <DataTable
          columns={["Name", "Environment Type", "Secrets", "Pipelines", "Last Updated", "Created By"]}>
          <tr>
            <td className={styles.filter}>
              <div>production</div>
              <ion-icon name="lock-closed-outline"></ion-icon>
            </td>
            <td><Pill variant="development" label="Development" /></td>
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
            <td><Pill variant="staging" label="Staging" /></td>
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
            <td><Pill variant="production" label="Production" /></td>
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
            <td><Pill variant="preview" label="Preview" /></td>
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
            <td><Pill variant="custom" label="Custom" /></td>
            <td className={styles.filter}>
              <ion-icon name="key-outline"></ion-icon>
              <div>8</div>
            </td>
            <td>3</td>
            <td>8d ago</td>
            <td>coco</td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}