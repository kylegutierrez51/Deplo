import { notFound } from "next/navigation";
import styles from "./run-detail.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import RunDetailCard from "@/components/run-detail/RunDetailCard";
import LogsTab from "@/components/run-detail/logs/LogsTab";
import Pill from '@/components/ui/Pill';
import RunDetailShell from "./RunDetailShell";
import AutoRefresh from "@/components/ui/AutoRefresh";
import PipelineGraph from "@/components/run-detail/PipelineGraph";
import { getRunDetailById } from "@/lib/data/run-detail";

interface RunDetailPageProps {
  params: Promise<{ runId: string }>;
}

const REFRESH_INTERVAL_MS = 2000;

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

        <AutoRefresh
          intervalMs={REFRESH_INTERVAL_MS}
          enabled={['queued', 'running'].includes(run.status) || run.jobCounts.running > 0}
        />

        <RunDetailShell
          header={
            <RunDetailCard
              id={runId}
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
          }
          overview={
            <>
              <div className={styles['job-statuses']}>
                <Pill variant="total" label={`${run.jobCounts.total} Total`} />
                <Pill variant="succeeded" label={`${run.jobCounts.succeeded} Succeeded`} />
                <Pill variant="running" label={`${run.jobCounts.running} Running`} />
                <Pill variant="queued" label={`${run.jobCounts.queued} Queued`} />
                {run.jobCounts.failed > 0 && <Pill variant="failed" label={`${run.jobCounts.failed} Failed`} />}
                {run.jobCounts.awaitingApproval > 0 && <Pill variant="awaiting-approval" label={`${run.jobCounts.awaitingApproval} Awaiting Approval`} />}
                {run.jobCounts.approved > 0 && <Pill variant="approved" label={`${run.jobCounts.approved} Approved`} />}
                {run.jobCounts.unapproved > 0 && <Pill variant="unapproved" label={`${run.jobCounts.unapproved} Unapproved`} />}
                {run.jobCounts.cancelled > 0 && <Pill variant="cancelled" label={`${run.jobCounts.cancelled} Cancelled`} />}
              </div>
              <div className={styles.graph}>
                <PipelineGraph nodes={run.nodes} edges={run.edges} envPresent={run.environment ? true : false} />
              </div>
            </>
          }
          logs={
            <LogsTab logs={run.logs} logFilters={run.logFilters} />
          }
        />

      </main>
    </>
  )
}
