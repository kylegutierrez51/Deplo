import styles from "./run-history.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/Sidebar";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import Pill from '@/components/Pill';

import Link from 'next/link';

export default function RunHistory() {
  return (
    <>
      <Sidebar activeItem="run-history"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Run History"
          subtitle="All pipeline executions across your projects."
          badge={{ count: 3, label: 'Active' }}>
          <button>
            <ion-icon name="caret-forward-outline"></ion-icon>
            Run Pipeline
          </button>
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search pipelines, commits..."} />
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
              id={"trigger"} name={"trigger"}
              options={
                [
                  { value: "all", label: "All triggers" },
                  { value: "webhook", label: "Webhook" },
                  { value: "manual", label: "Manual" },
                  { value: "api", label: "API" },
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
            <FilterSelect
              id={"recency"} name={"recency"}
              options={
                [
                  { value: "most-recent", label: "Most recent" },
                  { value: "least-recent", label: "Least recent" }
                ]
              } />
          </div>
        </div>
        
        <DataTable
          columns={["Pipeline", "Environment Type", "Trigger", "Duration", "Time"]}>
          <tr className={styles["clickable-row"]}>
            <td><Pill variant="queued" label="Queued" /> deploy-api <br /><span>acbcd/api-server</span> &bull; v12</td>
            <td><Pill variant="production" label="Production" /></td>
            <td><Pill variant="webhook" label="Webhook" /></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">-</div>
            </td>
            <td><Link href="runs/1" className={`${styles['stretched-link']} ${'nowrap'}`}>6h ago</Link></td>
          </tr>
          <tr className={styles["clickable-row"]}>
            <td><Pill variant="running" label="Running" /> build-frontend <br /><span>acbcd/web-client</span> &bull; v8</td>
            <td><Pill variant="staging" label="Staging" /></td>
            <td><Pill variant="manual" label="Manual" /></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">6h 1m</div>
            </td>
            <td><Link href="runs/1" className={`${styles['stretched-link']} ${'nowrap'}`}>6h ago</Link></td>
          </tr>
          <tr className={styles["clickable-row"]}>
            <td><Pill variant="succeeded" label="Succeeded" /> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
            <td><Pill variant="development" label="Development" /></td>
            <td><Pill variant="api" label="API" /></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">8m 0s</div>
            </td>
            <td><Link href="runs/1" className={`${styles['stretched-link']} ${'nowrap'}`}>11h ago</Link></td>
          </tr>
          <tr className={styles["clickable-row"]}>
            <td><Pill variant="failed" label="Failed" /> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
            <td><Pill variant="preview" label="Preview" /></td>
            <td><Pill variant="webhook" label="Webhook" /></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">8m 0s</div>
            </td>
            <td><Link href="runs/1" className={`${styles['stretched-link']} ${'nowrap'}`}>11h ago</Link></td>
          </tr>
          <tr className={styles["clickable-row"]}>
            <td><Pill variant="cancelled" label="Cancelled" /> deploy-api <br /><span>acbcd/api-server</span> &bull; v14</td>
            <td><Pill variant="custom" label="Custom" /></td>
            <td><Pill variant="manual" label="Manual" /></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">8m 0s</div>
            </td>
            <td><Link href="runs/1" className={`${styles['stretched-link']} ${'nowrap'}`}>12h ago</Link></td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}
