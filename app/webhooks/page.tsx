import styles from "./webhooks.module.css"
import Subheader from "@/components/Subheader"
import Sidebar from "@/components/Sidebar"
import FilterSelect from "@/components/filters/FilterSelect"
import SearchInput from "@/components/filters/SearchInput";
import WebhookCard from "@/components/WebhookCard";
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

          <div className={styles['webhook-layout']}>
            <WebhookCard
              repo={"abcd/infra"}
              status={"Inactive"}
              events={["push", "pull_request"]}
              secretPreview={"whsec_••••••••••••••••"}
              lastDelivery={"10d"}
              registeredAgo={"63d"}>
            </WebhookCard>
                
            <WebhookCard
              repo={"abcd/infra"}
              status={"Active"}
              events={["push"]}
              secretPreview={"whsec_••••••••••••••••"}
              lastDelivery={"10d"}
              registeredAgo={"63d"}>
            </WebhookCard>
          
            <WebhookCard
              repo={"abcd/api-server"}
              status={"Active"}
              events={["pull_request"]}
              secretPreview={"whsec_••••••••••••••••"}
              lastDelivery={"10d"}
              registeredAgo={"63d"}>
            </WebhookCard>
          </div>
          
          <Pagination showing="1-3 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} styles={styles} />
        </div>
      </main>
    </>
  )
}