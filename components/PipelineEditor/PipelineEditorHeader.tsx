"use client"

import Link from 'next/link';
import styles from './pipeline-editor-header.module.css'
import FilterSelect from '../Filters/FilterSelect';

/*
onAddStage: () => void;
onSaveDraft: () => void;
onRunPipeline: () => void;
*/
interface PipelineEditorHeaderProps {
  pipelineName: string,
  stageCount: number,
  connectionCount: number;
  onSidebarToggle: () => void;
}
export default function PipelineEditorHeader({ pipelineName, stageCount, connectionCount, onSidebarToggle }: PipelineEditorHeaderProps) {
  return (
    <header className={styles["editor-header"]}>
      <div className={styles['header-flex']}>

        <div className={styles['left-side']}>
          <button className={styles['sidebar-toggle']} id="sidebarToggle" onClick={onSidebarToggle}>
            <ion-icon name="menu-outline"></ion-icon>
          </button>
          <div className={styles.divider}></div>
          <div className={styles['pipeline-title']}>
            <Link href="/pipelines">Pipelines</Link>
            <div>|</div>
            <div className={styles.nowrap}>{pipelineName}</div>
          </div>
          <FilterSelect
            id={"environment"} name={"environment"} responsive={false}
            options={
              [
                { value: "production", label: "Production" },
                { value: "staging", label: "Staging" },
                { value: "development", label: "Development" },
                { value: "preview", label: "Preview" },
                { value: "custom", label: "Custom" },
              ]
            } />
          <div className={styles['nodes-edges']}>
            <span className="nowrap">{stageCount} stages</span>
            <span>&bull;</span>
            <span className="nowrap">{connectionCount} connections</span>
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
  )
}