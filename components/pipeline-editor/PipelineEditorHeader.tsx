'use client'

import Link from 'next/link';
import styles from './pipeline-editor-header.module.css'
import HeaderButtons from './HeaderButtons';
import { MainSidebarToggle } from './PipelineEditorChrome';
import { usePipelineGraph } from './PipelineGraphProvider';

interface PipelineEditorHeaderProps {
  pipelineName: string,
}
export default function PipelineEditorHeader({ pipelineName }: PipelineEditorHeaderProps) {
  const { nodes, edges } = usePipelineGraph();

  return (
    <header className={styles["editor-header"]}>
      <div className={styles['header-flex']}>
        <div className={styles['left-side']}>
          <MainSidebarToggle className={styles['sidebar-toggle']}>
            <ion-icon name="menu-outline"></ion-icon>
          </MainSidebarToggle>
          <div className={styles.divider}></div>
          <div className={styles['pipeline-title']}>
            <Link href="/pipelines">Pipelines</Link>
            <div className={styles.divider}></div>
            <div className={"nowrap"}>{pipelineName}</div>
            <div className={styles.divider}></div>
            <div className={styles['nodes-edges']}>
              <span className="nowrap">{nodes.length} stages</span>
              <span>&bull;</span>
              <span className="nowrap">{edges.length} connections</span>
            </div>
          </div>
        </div>
        <HeaderButtons />
      </div>
    </header>
  )
}