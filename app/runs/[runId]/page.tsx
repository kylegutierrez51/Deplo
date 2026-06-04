"use client"

import { useState } from "react"
import styles from "./run-detail.module.css"
import Sidebar from "@/components/Sidebar/Sidebar"
import FilterSelect from "@/components/Filters/FilterSelect"
import SearchInput from "@/components/Filters/SearchInput"
import RunDetailCard from "@/components/Cards/RunDetail/RunDetailCard"

type Tab = 'overview' | 'logs'

export default function RunDetail() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
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

          <div className={styles.sections}>
            <div className={styles['tabs-row']}>
              <button
                className={`${styles.section} ${activeTab === 'overview' ? styles.active : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <ion-icon name="layers-outline"></ion-icon>
                <span>Overview</span>
              </button>
              <button
                className={`${styles.section} ${activeTab === 'logs' ? styles.active : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <ion-icon name="receipt-outline"></ion-icon>
                <span>Logs</span>
              </button>
            </div>
          </div>

          <section className={styles.overview} id="section-overview" style={{ display: activeTab === 'overview' ? undefined : 'none' }}>
            <div className={styles['job-statuses']}>
              <div className="pill pill--total">8 Total</div>
              <div className="pill pill--succeeded">4 Succeeded</div>
              <div className="pill pill--running">1 Running</div>
              <div className="pill pill--queued">3 Queued</div>
              <div className="pill pill--failed"> 0 Failed</div>
              <div className="pill pill--approval">0 Awaiting Approval</div>
            </div>

            <div className={styles.pipeline}>
              <div className={styles['pipeline-inner']}>

                {/* install-deps */}
                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>install-deps</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className="pill pill--succeeded">Succeeded</div>
                    <span>42s</span>
                  </div>
                </div>

                {/* Fork: install-deps → lint + unit-tests */}
                <div className={styles['connector-fork']}>
                  <div className={styles['cf-stem']}></div>
                  <div className={styles['cf-arms']}>
                    <div className={styles['cf-spacer']}></div>
                    <div className={`${styles['cf-arm']} ${styles['cf-arm-left']}`}></div>
                    <div className={`${styles['cf-arm']} ${styles['cf-arm-right']}`}></div>
                    <div className={styles['cf-spacer']}></div>
                  </div>
                </div>

                {/* Parallel: lint + unit-tests */}
                <div className={styles['parallel-row']}>
                  <div className={styles.job}>
                    <div className={styles['job-name']}>
                      <span>lint</span>
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </div>
                    <div className={styles['job-status-time']}>
                      <div className="pill pill--succeeded">Succeeded</div>
                      <span>38s</span>
                    </div>
                  </div>
                  <div className={styles.job}>
                    <div className={styles['job-name']}>
                      <span>unit-tests</span>
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </div>
                    <div className={styles['job-status-time']}>
                      <div className="pill pill--succeeded">Succeeded</div>
                      <span>2m 13s</span>
                    </div>
                  </div>
                </div>

                {/* Merge: lint + unit-tests → build */}
                <div className={styles['connector-merge']}>
                  <div className={styles['cm-arms']}>
                    <div className={styles['cm-spacer']}></div>
                    <div className={`${styles['cm-arm']} ${styles['cm-arm-left']}`}></div>
                    <div className={`${styles['cm-arm']} ${styles['cm-arm-right']}`}></div>
                    <div className={styles['cm-spacer']}></div>
                  </div>
                  <div className={styles['cm-stem']}></div>
                </div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>build</span>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className="pill pill--succeeded">Succeeded</div>
                    <span>1m 25s</span>
                  </div>
                </div>

                {/* Connector: build → deploy-staging (active) */}
                <div className={`${styles['connector-straight']} ${styles.active}`}></div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>deploy-staging</span>
                    <ion-icon name="sync-outline" className={styles['job-icon-running']}></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className="pill pill--running">Running</div>
                    <span>24m 4s</span>
                  </div>
                </div>

                {/* Connector: deploy-staging → smoke-tests */}
                <div className={styles['connector-straight']}></div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>smoke-tests</span>
                    <ion-icon name="time-outline" className={styles['job-icon-pending']}></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className="pill pill--queued">Queued</div>
                  </div>
                </div>

                {/* Connector: smoke-tests → manual-approval */}
                <div className={styles['connector-straight']}></div>

                <div className={styles.job}>
                  <div className={styles['job-name']}>
                    <span>manual-approval</span>
                    <ion-icon name="time-outline" className={styles['job-icon-pending']}></ion-icon>
                  </div>
                  <div className={styles['job-status-time']}>
                    <div className="pill pill--queued">Queued</div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          <section className={styles.logs} id="section-logs" style={{ display: activeTab === 'logs' ? undefined : 'none' }}>

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

            <div className={styles['log-viewer']}>

              <div className={styles['log-header']}>
                <div className={styles['log-header-left']}>
                  <ion-icon name="checkmark-circle-outline" className={`${styles['log-job-icon']} ${styles.succeeded}`}></ion-icon>
                  <span className={styles['log-job-name']}>install-deps</span>
                  <span className={styles['log-job-cmd']}>npm ci --production=false</span>
                </div>
                <span className={styles['log-duration']}>42s</span>
              </div>

              <div className={styles['log-body']}>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>1</span>
                  <span className={styles['log-time']}>00:00.0</span>
                  <span className={styles['log-content']}><span className={styles['log-prompt']}>$</span> npm ci --production=false</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>2</span>
                  <span className={styles['log-time']}>00:00.3</span>
                  <span className={`${styles['log-content']} ${styles['log-warn']}`}>npm warn deprecated inflight@1.0.6: This module is not supported</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>3</span>
                  <span className={styles['log-time']}>00:02.1</span>
                  <span className={styles['log-content']}>added 1,247 packages in 38s</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>4</span>
                  <span className={styles['log-time']}>00:02.2</span>
                  <span className={styles['log-content']}>182 packages are looking for funding</span>
                </div>
                <div className={styles['log-line']}>
                  <span className={styles['log-num']}>5</span>
                  <span className={styles['log-time']}>00:42.0</span>
                  <span className={`${styles['log-content']} ${styles['log-success']}`}>&#10003; Dependencies installed successfully</span>
                </div>
              </div>

              <div className={styles['log-footer']}>
                <span>Process exited with code 0</span>
              </div>

            </div>
          </section>

        </div>
      </main>
    </>
  )
}
