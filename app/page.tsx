import { auth } from "@/auth";
import Link from "next/link";
import LoginButton from "@/components/LoginButton";
import Sidebar from "@/components/sidebar/Sidebar";
import Subheader from "@/components/subheader/Subheader";
import StatCards from "@/components/StatCards";
import Pill from "@/components/Pill";
import { getDashboardData } from "@/lib/data/dashboard";
import { capitalize } from "@/lib/utils/string";
import { formatDate, getDuration } from "@/lib/utils/date";
import loginStyles from "./page.module.css";
import styles from "./dashboard.module.css";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <div className={loginStyles['login-container']}>
        <div className={loginStyles['login-flex']}>
          <div className={loginStyles.title}>Deplo</div>
          <LoginButton />
        </div>
      </div>
    );
  }

  const data = await getDashboardData();
  const firstName = session.user?.name?.split(" ")[0];

  return (
    <>
      <Sidebar activeItem="dashboard" />

      <main className="page-content">

        <Subheader
          title="Dashboard"
          subtitle={firstName
            ? `Here's what your pipelines are doing, ${firstName}.`
            : "Here's what your pipelines are doing."}
          badge={data.counts.running > 0 ? { count: data.counts.running, label: 'Running' } : undefined}>
        </Subheader>

        <StatCards
          cards={
            [
              { icon: "sync-outline", total: data.counts.running, label: "RUNNING" },
              { icon: "hourglass-outline", total: data.counts.queued, label: "QUEUED", valueClassName: 'queued' },
              { icon: "shield-outline", total: data.counts.awaitingApproval, label: "NEEDS APPROVAL", valueClassName: 'pending' },
              { icon: "close-circle-outline", total: data.counts.failed7d, label: "FAILED", valueClassName: 'failed' },
            ]
          } />

        <div className={styles['dashboard-grid']}>

          <section className={styles.panel} aria-label="Recent runs">
            <header className={styles['panel-header']}>
              <span className={styles['panel-title']}>RECENT RUNS</span>
              <Link href="/runs" className={styles['panel-link']}>View all</Link>
            </header>
            {data.recentRuns.length === 0 ? (
              <p className={styles['empty-note']}>No runs yet. Trigger a pipeline to see activity here.</p>
            ) : (
              <ul className={styles['run-list']}>
                {data.recentRuns.map((run) => (
                  <li key={run.id}>
                    <Link href={`/runs?id=${run.id}`} className={styles['run-row']}>
                      <Pill variant={run.status} label={capitalize(run.status)} />
                      <div className={styles['run-info']}>
                        <span className={styles['run-pipeline']}>{run.pipelineName ?? "Deleted pipeline"}</span>
                        <span className={styles['run-meta']}>
                          {run.branch ?? "—"}{run.commitSha ? ` · ${run.commitSha.slice(0, 7)}` : ""}
                        </span>
                      </div>
                      {run.environment && (
                        <Pill variant={run.environment.type} label={capitalize(run.environment.type)} />
                      )}
                      <div className={styles['run-timing']}>
                        <span className={styles['run-duration']}>
                          <ion-icon name="stopwatch-outline"></ion-icon>
                          {run.startedAt && run.finishedAt
                            ? getDuration(run.startedAt, run.finishedAt)
                            : run.startedAt ? 'Ongoing' : '—'}
                        </span>
                        <span className={styles['run-date']}>{formatDate(run.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className={styles['side-column']}>

            <section className={styles.panel} aria-label="Last 7 days">
              <header className={styles['panel-header']}>
                <span className={styles['panel-title']}>LAST 7 DAYS</span>
              </header>
              {data.week.successRate === null ? (
                <p className={styles['empty-note']}>No finished runs this week yet.</p>
              ) : (
                <div className={styles['week-body']}>
                  <div className={styles['success-hero']}>
                    <span className={styles['success-rate']}>{data.week.successRate}%</span>
                    <span className={styles['success-caption']}>
                      of {data.week.finished} finished {data.week.finished === 1 ? 'run' : 'runs'} succeeded
                    </span>
                  </div>
                  <div
                    className={styles.meter}
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={data.week.successRate}
                    aria-label="Success rate over the last 7 days">
                    <div className={styles['meter-fill']} style={{ width: `${data.week.successRate}%` }} />
                  </div>
                  <div className={styles['week-counts']}>
                    <span className={styles['count-succeeded']}>{data.week.succeeded} succeeded</span>
                    <span className={styles['count-failed']}>{data.week.failed} failed</span>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.panel} aria-label="Needs approval">
              <header className={styles['panel-header']}>
                <span className={styles['panel-title']}>NEEDS APPROVAL</span>
                <Link href="/approvals" className={styles['panel-link']}>View all</Link>
              </header>
              {data.approvals.length === 0 ? (
                <p className={styles['empty-note']}>Nothing is waiting on you.</p>
              ) : (
                <ul className={styles['approval-list']}>
                  {data.approvals.map((approval) => (
                    <li key={approval.id}>
                      <Link href="/approvals" className={styles['approval-row']}>
                        <div className={styles['approval-info']}>
                          <span className={styles['approval-pipeline']}>{approval.pipelineName}</span>
                          {approval.environment && (
                            <Pill variant={approval.environment.type} label={capitalize(approval.environment.type)} />
                          )}
                        </div>
                        <span className={styles['waiting-time']}>{getDuration(approval.waitingSince)} waiting</span>
                      </Link>
                    </li>
                  ))}
                  {data.moreApprovals > 0 && (
                    <li className={styles['more-note']}>+{data.moreApprovals} more waiting</li>
                  )}
                </ul>
              )}
            </section>

            <section className={styles.panel} aria-label="Pipelines">
              <header className={styles['panel-header']}>
                <span className={styles['panel-title']}>PIPELINES</span>
                <Link href="/pipelines" className={styles['panel-link']}>View all</Link>
              </header>
              {data.pipelines.length === 0 ? (
                <p className={styles['empty-note']}>No pipelines yet. Create one to start deploying.</p>
              ) : (
                <ul className={styles['pipeline-list']}>
                  {data.pipelines.map((pipeline) => (
                    <li key={pipeline.id}>
                      <Link href={`/pipelines?id=${pipeline.id}`} className={styles['pipeline-row']}>
                        <span
                          className={`${styles['status-dot']} ${styles[`dot-${pipeline.status}`]}`}
                          aria-hidden="true" />
                        <span className={styles['pipeline-name']}>{pipeline.name}</span>
                        <span className={styles['pipeline-meta']}>
                          {capitalize(pipeline.status)}{pipeline.lastRun ? ` · ${getDuration(pipeline.lastRun)} ago` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>
        </div>
      </main>
    </>
  );
}
