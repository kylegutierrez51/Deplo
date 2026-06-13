import styles from "./approvals.module.css"
import Sidebar from "@/components/sidebar/Sidebar";
import Subheader from "@/components/Subheader";
import StatCards from "@/components/StatCards";
import FilterSelect from "@/components/filters/FilterSelect"
import SearchInput from "@/components/filters/SearchInput"
import ApprovalCard from "@/components/approvals/ApprovalCard";
import Pagination from "@/components/Pagination";

export default function Approvals() {
  return (
    <>
      <Sidebar activeItem="approvals" />

      <main className="page-content">
        <div className="page-layout">

          <Subheader
            title="Approvals"
            subtitle="Pipeline runs waiting for manual approval before proceeding."
          />

          <StatCards
            cards={
              [
                { icon: "alert-circle-outline", total: 4, label: "PENDING" },
                { icon: "alert-circle-outline", total: 3, label: "PRODUCTION" },
                { icon: "stopwatch-outline", total: "18h 17m", label: "LONGEST WAIT", valueClassName: "wait-time" },
              ]
            }
            responsive={false} />

          <div className={styles.filters}>
            <div className={styles['filters-bar']}>
              <SearchInput
                placeholder={"Search by pipeline, repo, branch, user..."}
                styles={styles} />
              <FilterSelect
                id={"environment"} name={"environment"}
                styles={styles}
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
                styles={styles}
                options={
                  [
                    { value: "most-recent", label: "Most recent" },
                    { value: "least-recent", label: "Least recent" }
                  ]
                } />
            </div>
          </div>

          <div className={styles['approvals-layout']}>
            <ApprovalCard
              pipelineName={"release-mobile"}
              environment={"Producion"}
              triggerType={"Manual"}
              commitHash={"c3d435f"}
              commitMessage={"fix: resolve deep link crash on Android 14"}
              author={"alex.kim"}
              branch={"main"}
              waitingTime={"18h 17m"}
              stagesComplete={"6/8"}
              runHref={"/runs"}
              stages={[
                { icon: "cube-outline", name: "install-deps", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "cube-outline", name: "lint", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "flask-outline", name: "unit-tests", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "shield-outline", name: "release-approval", statusIcon: "alert-circle-outline", notLast: true, isApproval: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: false },
              ]}
            />

            <ApprovalCard
              pipelineName={"release-mobile"}
              environment={"Producion"}
              triggerType={"Manual"}
              commitHash={"c3d435f"}
              commitMessage={"fix: resolve deep link crash on Android 14"}
              author={"alex.kim"}
              branch={"main"}
              waitingTime={"18h 17m"}
              stagesComplete={"6/8"}
              runHref={"/runs"}
              stages={[
                { icon: "cube-outline", name: "install-deps", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "cube-outline", name: "lint", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "flask-outline", name: "unit-tests", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "shield-outline", name: "release-approval", statusIcon: "alert-circle-outline", notLast: true, isApproval: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: false },
              ]}
            />

            <ApprovalCard
              pipelineName={"release-mobile"}
              environment={"Producion"}
              triggerType={"Manual"}
              commitHash={"c3d435f"}
              commitMessage={"fix: resolve deep link crash on Android 14"}
              author={"alex.kim"}
              branch={"main"}
              waitingTime={"18h 17m"}
              stagesComplete={"6/8"}
              runHref={"/runs"}
              stages={[
                { icon: "cube-outline", name: "install-deps", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "cube-outline", name: "lint", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "flask-outline", name: "unit-tests", statusIcon: "checkmark-circle-outline", notLast: true },
                { icon: "shield-outline", name: "release-approval", statusIcon: "alert-circle-outline", notLast: true, isApproval: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: true },
                { icon: "rocket-outline", name: "publish-stores", statusIcon: "time-outline", notLast: false },
              ]}
            />
          </div>

          <Pagination showing="1-3 of 20" pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} styles={styles} />
        </div>
      </main>
    </>
  )
}