import styles from "./run-detail.module.css";
import Sidebar from "@/components/sidebar/Sidebar";
import RunDetailCard from "@/components/run-detail/RunDetailCard";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import LogViewer from "@/components/run-detail/logs/LogViewer";
import PipelineGraph, { type PipelineNode } from "@/components/run-detail/pipeline-graph/PipelineGraph";
import Pill from '@/components/Pill';
import RunTabs from "./RunTabs";

const pipelineNodes: PipelineNode[] = [
  { type: 'job', name: 'install-deps', statusIcon: 'checkmark-circle-outline', status: 'succeeded', duration: '42s' },
  { type: 'connector-fork' },
  {
    type: 'parallel',
    jobs: [
      { name: 'lint',       statusIcon: 'checkmark-circle-outline', status: 'succeeded', duration: '38s' },
      { name: 'unit-tests', statusIcon: 'checkmark-circle-outline', status: 'succeeded', duration: '2m 13s' },
    ],
  },
  { type: 'connector-merge' },
  { type: 'job', name: 'build',          statusIcon: 'checkmark-circle-outline', status: 'succeeded', duration: '1m 25s' },
  { type: 'connector-straight', active: true },
  { type: 'job', name: 'deploy-staging', statusIcon: 'sync-outline',             status: 'running',   duration: '24m 4s' },
  { type: 'connector-straight' },
  { type: 'job', name: 'smoke-tests',    statusIcon: 'time-outline',             status: 'queued' },
  { type: 'connector-straight' },
  { type: 'job', name: 'manual-approval', statusIcon: 'time-outline',            status: 'queued' },
];

export default function RunDetail() {
  return (
    <>
      <Sidebar activeItem="run-detail" />

      <main className="page-content">
        <div className="page-layout">

          <RunDetailCard
            pipelineName={"deploy-api"}
            runNumber={47}
            status={"Running"}
            environment={"Production"}
            commitHash={"a1b2c3d"}
            commitMessage={"fix: resolve connection pool e..."}
            branch={"main"}
            repo={"acme/api-server"}
            trigger={"webhook"}
            triggeredBy={"sarah.chen"}
            duration={"7m 12s"}
            timeAgo={"7m"}
          />

          <RunTabs
            overview={
              <>
                <div className={styles['job-statuses']}>
                  <Pill variant="total" label="8 Total" />
                  <Pill variant="succeeded" label="4 Succeeded" />
                  <Pill variant="running" label="1 Running" />
                  <Pill variant="queued" label="3 Queued" />
                  <Pill variant="failed" label="0 Failed" />
                  <Pill variant="approval" label="0 Awaiting Approval" />
                </div>
                <PipelineGraph nodes={pipelineNodes} />
              </>
            }
            logs={
              <>
                <div className={styles.filters}>
                  <div className={styles['filters-bar']}>
                    <FilterSelect
                      id={"status"} name={"status"}
                      styles={styles}
                      options={
                        [
                          { value: "stage", label: "install deps - succeeded" },
                          { value: "stage", label: "lint - succeeded" },
                          { value: "stage", label: "unit-tests - succeeded" },
                          { value: "stage", label: "build - succeeded" },
                          { value: "stage", label: "deploy-staging - running" },
                          { value: "stage", label: "smoke-tests - pending" },
                          { value: "stage", label: "manual-approval - pending" },
                          { value: "stage", label: "deploy-production - pending" },
                        ]
                      } />
                    <SearchInput
                      placeholder={"Search logs..."}
                      styles={styles} />
                  </div>
                </div>

                <LogViewer
                  jobName={"install-deps"}
                  command={"npm ci --production=false"}
                  status={"running"}
                  duration={"42s"}
                  lines={
                    [
                      {lineNumber: 1, timestamp: "00:00.0", content: "npm ci --production=false"},
                      {lineNumber: 2, timestamp: "00:00.3", content: "npm warn deprecated inflight@1.0.6: This module is not supported"},
                      {lineNumber: 3, timestamp: "00:02.1", content: "added 1,247 packages in 38s"},
                      {lineNumber: 4, timestamp: "00:02.2", content: "182 packages are looking for funding"},
                      {lineNumber: 5, timestamp: "00:42.0", content: "&#10003; Dependencies installed successfully"},

                    ]
                  }
                />
              </>
            }
          />

        </div>
      </main>
    </>
  )
}
