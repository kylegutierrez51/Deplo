import { notFound } from "next/navigation";
import styles from "./run-detail.module.css";
import Sidebar from "@/components/sidebar/Sidebar";
import RunDetailCard from "@/components/run-detail/RunDetailCard";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import LogViewer from "@/components/run-detail/logs/LogViewer";
import PipelineGraph, { type PipelineNode } from "@/components/run-detail/pipeline-graph/PipelineGraph";
import Pill from '@/components/Pill';
import RunTabs from "./RunTabs";
import { getRunDetailById, type JobStatus } from "@/lib/data/run-detail";
import { capitalize } from "@/lib/utils/string";

interface RunDetailPageProps {
  params: Promise<{ runId: string }>;
}

const STATUS_ICONS: Record<JobStatus, string> = {
  succeeded: 'checkmark-circle-outline',
  running: 'sync-outline',
  failed: 'close-circle-outline',
  queued: 'time-outline',
  pending: 'time-outline',
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = await getRunDetailById(Number(runId));

  if (!run) {
    notFound();
  }

  const pipelineNodes: PipelineNode[] = run.graph.map((node) => {
    if (node.type === 'job') {
      return { ...node, statusIcon: STATUS_ICONS[node.status] };
    }
    if (node.type === 'parallel') {
      return { ...node, jobs: node.jobs.map((job) => ({ ...job, statusIcon: STATUS_ICONS[job.status] })) };
    }
    return node;
  });

  return (
    <>
      <Sidebar activeItem="run-detail" />

      <main className="page-content">
        <div className="page-layout">

          <RunDetailCard
            pipelineName={run.pipelineName}
            runNumber={run.runNumber}
            status={capitalize(run.status)}
            environment={capitalize(run.environment)}
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
                  {run.jobCounts.awaitingApproval > 0 && <Pill variant="approval" label={`${run.jobCounts.awaitingApproval} Awaiting Approval`} />}
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
                      options={run.logFilters}
                    />
                    <SearchInput
                      placeholder={"Search logs..."}
                      styles={styles} />
                  </div>
                </div>

                {run.logs.map((log, index) => (
                  <LogViewer
                    key={index}
                    jobName={log.jobName}
                    command={log.command}
                    status={log.status}
                    duration={log.duration}
                    lines={log.lines}
                  />
                ))}
              </>
            }
          />

        </div>
      </main>
    </>
  )
}
