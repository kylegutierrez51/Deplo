"use client"

import styles from "./pipeline-editor.module.css"
import Sidebar from "@/components/Sidebar/Sidebar"
import FilterSelect from "@/components/Filters/FilterSelect"

import { useState } from "react"

export default function PipelineEditor() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar activeItem="pipelines" showToggle={false} open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)}></Sidebar>

      <header className={styles["editor-header"]}>
        <div className={styles['header-flex']}>

          <div className={styles['left-side']}>
            <button className={styles['sidebar-toggle']} id="sidebarToggle" onClick={() => setSidebarOpen(o => !o)}>
              <ion-icon name="menu-outline"></ion-icon>
            </button>
            <div className={styles.divider}></div>
            <div className={styles['pipeline-title']}>
              <a href="pipeline-list.html">Pipelines</a>
              <div>|</div>
              <div className={styles.nowrap}>deploy-api</div>
            </div>
            <FilterSelect 
              id={"environment"} name={"environment"} 
              options={
                [
                  { value : "production", label: "Production" },
                  { value : "staging", label: "Staging" },
                  { value : "development", label: "Development" },
                  { value : "preview", label: "Preview" },
                  { value : "custom", label: "Custom" },
                ]
              }/>
            <div className={styles['nodes-edges']}>
              <span className="nowrap">7 stages</span>
              <span>&bull;</span>
              <span className="nowrap">6 connections</span>
            </div>
          </div>

          <div className={styles['right-side']}>
            <button className={styles['add-stage-btn']}>
              <ion-icon name="add-outline"></ion-icon>
              Add Stage
            </button>
            <div className={styles.divider}></div>
            <div className={styles['sidebar-icon']}>
              <ion-icon name="journal-outline"></ion-icon>
            </div>
            <div className={styles.divider}></div>
            <button className={styles['save-btn']}>
              <ion-icon name="save-outline"></ion-icon>
              Save Draft
            </button>
            <button className={styles['run-btn']}>
              <ion-icon name="caret-forward-outline"></ion-icon>
              Run Pipeline
            </button>
          </div>

        </div>
      </header>

      <main className="page-content">
        <button id="stageSidebarToggle" className={styles['toggle-stage-sidebar']}>Open Stage Sidebar</button>
      </main>

      <aside className={styles['stage-sidebar']}>
        <div className={styles['stage-sidebar-header']}>
          <div className={styles['stage-title']}>
            <div className={styles['icon-border']}>
              <ion-icon name="rocket-outline"></ion-icon>
            </div>
            <div className={styles.title}>Configure Stage</div>
          </div>
          <button className={styles['exit-btn']}><ion-icon name="close-outline"></ion-icon></button>
        </div>

        <form id="post-form" method="POST">
          <div className={styles['stage-sidebar-nav']}>

            <div className={styles['stage-name']}>
              <label htmlFor="stage-name">STAGE NAME</label>
              <input id="stage-name" name="stage-name" placeholder="e.g. build" />
            </div>

            <div className={styles['stage-types']}>
              <label>STAGE TYPE</label>
              <div className={styles['stage-type-grid']}>
                <div className={styles.item}>
                  <ion-icon name="hammer-outline"></ion-icon>
                  <div>Build</div>
                </div>
                <div className={styles.item}>
                  <ion-icon name="pencil-outline"></ion-icon>
                  <div>Test</div>
                </div>
                <div className={styles.item}>
                  <ion-icon name="rocket-outline"></ion-icon>
                  <div>Deploy</div>
                </div>
                <div className={styles.item}>
                  <ion-icon name="shield-checkmark-outline"></ion-icon>
                  <div>Approval</div>
                </div>
                <div className={styles.item}>
                  <ion-icon name="code-outline"></ion-icon>
                  <div>Script</div>
                </div>
              </div>
            </div>

            <div className={styles.command}>
              <label htmlFor="command">COMMAND</label>
              <textarea id="command" name="command" placeholder="e.g. npm run build"></textarea>
            </div>

            <div className={styles['timeout-and-retries']}>
              <div className={styles.timeout}>
                <div>
                  <ion-icon name="time-outline"></ion-icon>
                  <label htmlFor="timeout">TIMEOUT (S)</label>
                </div>
                <input id="timeout" name="timeout" placeholder="e.g. npm run build" defaultValue="0" />
              </div>
              <div className={styles.retries}>
                <div>
                  <ion-icon name="refresh-outline"></ion-icon>
                  <label htmlFor="retries">RETRIES</label>
                </div>
                <input id="retries" name="retries" placeholder="e.g. npm run build" defaultValue="0" />
              </div>
            </div>

            <div className={styles['env-vars']}>
              <div className={styles['env-title-container']}>
                <div className={styles['env-title']}>
                  <ion-icon name="settings-outline"></ion-icon>
                  <label>ENV VARIABLES</label>
                </div>
                <button className={styles['add-env-btn']}>
                  <ion-icon name="add-outline"></ion-icon>
                  Add
                </button>
              </div>
              <div className={styles['env-vars-list']}>
                <div className={styles['env-container']}>
                  <input name="env-key" placeholder="KEY" />
                  <span>=</span>
                  <input name="env-value" placeholder="VALUE" />
                </div>
                <div className={styles['env-container']}>
                  <input name="env-key" placeholder="KEY" />
                  <span>=</span>
                  <input name="env-value" placeholder="VALUE" />
                </div>
              </div>
            </div>

            <div className={styles.secrets}>
              <div className={styles['secrets-info']}>
                <div>
                  <ion-icon name="lock-closed-outline"></ion-icon>
                  <label>SECRETS</label>
                </div>
                <div className={styles.info}>Injected at runtime. Never logged.</div>
              </div>
              <input id="secret" name="secret" placeholder="e.g. DATABASE_URL" />
            </div>

            <div className={styles['secrets-list']}>
              <label className={styles['secret-container']}>
                <div className={styles.secret}>
                  <input type="checkbox" />
                  <span className={styles['secret-key']}>DATABASE_URL</span>
                </div>
                <span className={styles['secret-env']}>production</span>
              </label>
              <label className={styles['secret-container']}>
                <div className={styles.secret}>
                  <input type="checkbox" />
                  <span className={styles['secret-key']}>DATABASE_URL</span>
                </div>
                <span className={styles['secret-env']}>production</span>
              </label>
              <label className={styles['secret-container']}>
                <div className={styles.secret}>
                  <input type="checkbox" />
                  <span className={styles['secret-key']}>DATABASE_URL</span>
                </div>
                <span className={styles['secret-env']}>production</span>
              </label>
              <label className={styles['secret-container']}>
                <div className={styles.secret}>
                  <input type="checkbox" />
                  <span className={styles['secret-key']}>DATABASE_URL</span>
                </div>
                <span className={styles['secret-env']}>production</span>
              </label>
              <label className={styles['secret-container']}>
                <div className={styles.secret}>
                  <input type="checkbox" />
                  <span className={styles['secret-key']}>DATABASE_URL</span>
                </div>
                <span className={styles['secret-env']}>production</span>
              </label>
              <label className={styles['secret-container']}>
                <div className={styles.secret}>
                  <input type="checkbox" />
                  <span className={styles['secret-key']}>DATABASE_URL</span>
                </div>
                <span className={styles['secret-env']}>production</span>
              </label>
            </div>
          </div>
        </form>
        <div className={styles['delete-stage']}>
          <button className={styles['delete-btn']}>
            <ion-icon name="trash-outline"></ion-icon>
            Delete Stage
          </button>
        </div>
      </aside>
    </>
  )
}