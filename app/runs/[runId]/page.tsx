import { notFound } from "next/navigation";
import styles from "./run-detail.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import RunDetailCard from "@/components/run-detail/RunDetailCard";
import LogsTab from "@/components/run-detail/logs/LogsTab";
import Pill from '@/components/ui/Pill';
import RunDetailShell from "./RunDetailShell";
import AutoRefresh from "@/components/ui/AutoRefresh";
import PipelineGraph from "@/components/run-detail/PipelineGraph";
import RunnerStatusBanner from "@/components/run-detail/RunnerStatusBanner";
import { getRunDetailById } from "@/lib/data/run-detail";
import { getRunnerAvailability } from "@/lib/queue/health";

interface RunDetailPageProps {
  params: Promise<{ runId: string }>;
}

const REFRESH_INTERVAL_MS = 2000;

const AWAITING_RUNNER = ['queued', 'running'];

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = await getRunDetailById(runId);

  if (!run) {
    notFound();
  }

  const runner = AWAITING_RUNNER.includes(run.status) ? await getRunnerAvailability() : null;

  return (
    <>
      <Sidebar activeItem="run-detail" />

      <main className={`page-content ${styles['run-main']}`}>

        <AutoRefresh
          intervalMs={REFRESH_INTERVAL_MS}
          enabled={AWAITING_RUNNER.includes(run.status) || run.jobCounts.running > 0}
        />

        <RunDetailShell
          header={
            <RunDetailCard
              run={{ id: runId, ...run,  }}
            />
          }
          overview={
            <>
              <div className={styles['overview-overlay']}>
                {runner && !runner.available && <RunnerStatusBanner reason={runner.reason} />}

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
