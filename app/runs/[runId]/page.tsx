import { notFound } from "next/navigation";
import styles from "./run-detail.module.css";
import Sidebar from "@/components/sidebar/Sidebar";
import RunDetailCard from "@/components/run-detail/RunDetailCard";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import Pill from '@/components/Pill';
import RunTabs from "./RunTabs";
import { getRunDetailById } from "@/lib/data/run-detail";
import PipelineGraph from "@/components/run-detail/PipelineGraph";

interface RunDetailPageProps {
  params: Promise<{ runId: string }>;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = await getRunDetailById(runId);

  if (!run) {
    notFound();
  }

  return (
    <>
      <Sidebar activeItem="run-detail" />

      <main className={`page-content ${styles['run-main']}`}>

        <RunDetailCard
          pipelineName={run.pipelineName}
          runNumber={run.runNumber}
          status={run.status}
          environment={run.environment}
          commitHash={run.commitHash}
          commitMessage={run.commitMessage}
          branch={run.branch}
          repo={run.repo}
          trigger={run.trigger}
          triggeredBy={run.triggeredBy}
          duration={run.duration}
          timeAgo={run.timeAgo}
        />

        <RunTabs
          overview={
            <>
              <div className={styles['job-statuses']}>
                <Pill variant="total" label={`${run.jobCounts.total} Total`} />
                <Pill variant="succeeded" label={`${run.jobCounts.succeeded} Succeeded`} />
                <Pill variant="running" label={`${run.jobCounts.running} Running`} />
                <Pill variant="queued" label={`${run.jobCounts.queued} Queued`} />
                {run.jobCounts.failed > 0 && <Pill variant="failed" label={`${run.jobCounts.failed} Failed`} />}
                {run.jobCounts.awaitingApproval > 0 && <Pill variant="awaiting-approval" label={`${run.jobCounts.awaitingApproval} Awaiting Approval`} />}
              </div>
              <div className={styles.graph}>
                <PipelineGraph nodes={run.nodes} edges={run.edges} />
              </div>
            </>
          }
          logs={
            <>
              <div className={styles.filters}>
                <div className={styles['filters-bar']}>
                  <FilterSelect
                    id={"status"} name={"status"}
                    styles={styles}
                    options={run.logFilters}
                  />
                  <SearchInput
                    placeholder={"Search logs..."}
                    styles={styles} />
                </div>
              </div>

              {/* {run.logs.map((log, index) => (
                <LogViewer
                  key={index}
                  jobName={log.jobName}
                  command={log.command}
                  status={log.status}
                  duration={log.duration}
                  lines={log.lines}
                />
              ))} */}
            </>
          }
        />

      </main>
    </>
  )
}
