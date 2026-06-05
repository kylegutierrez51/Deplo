import styles from "./webhook-events.module.css";
import Subheader from "@/components/Subheader";
import Sidebar from "@/components/Sidebar/Sidebar";
import StatCards from "@/components/Cards/StatCards";
import FilterSelect from "@/components/Filters/FilterSelect";
import SearchInput from "@/components/Filters/SearchInput";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import Pill from '@/components/Pill';

export default function Webhooks() {
  return (
    <>
      <Sidebar activeItem="webhooks"></Sidebar>

      <main className="page-content">

        <Subheader
          title="Webhook Events"
          subtitle="Incoming webhook deliveries from GitHub.">
          <button>
            <ion-icon name="refresh-outline"></ion-icon>
            Refresh
          </button>
        </Subheader>

        <StatCards
          cards={
            [
              { icon: "flash-outline", total: 7, label: "TOTAL EVENTS" },
              { icon: "checkmark-circle-outline", total: 3, label: "PROCESSED", valueClassName: 'processed' },
              { icon: "remove-circle-outline", total: 2, label: "IGNORED", valueClassName: 'ignored' },
              { icon: "close-circle-outline", total: 2, label: "FAILED", valueClassName: 'failed' },
            ]
          }>
        </StatCards>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput
              placeholder={"Search repo, branch, commit, pipeline, delivery ID..."}
              styles={styles} />
            <FilterSelect
              id={"status"} name={"status"}
              styles={styles}
              options={
                [
                  { value: "all", label: "All statuses" },
                  { value: "succeeded", label: "Processed" },
                  { value: "failed", label: "Ignored" },
                  { value: "running", label: "Failed" },
                ]
              } />
            <FilterSelect
              id={"event-type"} name={"event-type"}
              styles={styles}
              options={
                [
                  { value: "all", label: "All event types" },
                  { value: "today", label: "push" },
                  { value: "7days", label: "pull_request" },
                ]
              } />
          </div>
        </div>

        <DataTable
          columns={["Status", "Event", "Repository", "Branch", "Commit", "Pipeline", "Received"]}>
          <tr>
            <td><Pill variant="processed" label="Processed" /></td>
            <td><Pill variant="push" label="push" /></td>
            <td>abcd/api-server</td>
            <td>main</td>
            <td>a1b2c3d<br /><span>feat: add retry logic to webhook...</span></td>
            <td>deploy-api</td>
            <td>1h ago</td>
          </tr>
          <tr>
            <td><Pill variant="ignored" label="Ignored" /></td>
            <td><Pill variant="push" label="push" /></td>
            <td>abcd/web-client</td>
            <td>release/v2.4.0</td>
            <td>f4e5d6c<br /><span>feat: chore: bump dependencies to l...</span></td>
            <td>build-frontend</td>
            <td>2h ago</td>
          </tr>
          <tr>
            <td><Pill variant="failed" label="Failed" /></td>
            <td><Pill variant="pull-request" label="pull_request" /></td>
            <td>abcd/web-client</td>
            <td>feature/auth-flow</td>
            <td>7890abc<br /><span>feat: add user role migration for...</span></td>
            <td>db-migrate</td>
            <td>3h ago</td>
          </tr>
        </DataTable>

        <Pagination showing="1-10 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9}></Pagination>

      </main>
    </>
  )
}