'use client'

import Link from 'next/link';
import styles from './pipeline-editor-header.module.css'
import HeaderButtons from './HeaderButtons';
import EnvironmentSelect from './EnvironmentSelect';
import { MainSidebarToggle } from './PipelineEditorChrome';
import { usePipelineGraph } from './PipelineGraphProvider';
import type { Environment } from '@/lib/data/environments';

interface PipelineEditorHeaderProps {
  pipelineName: string,
  environments: Environment[]
}

export default function PipelineEditorHeader({ pipelineName, environments }: PipelineEditorHeaderProps) {
  const { nodes, edges } = usePipelineGraph();

  return (
    <header className={styles["editor-header"]}>
      <div className={styles['header-flex']}>
        <div className={styles['left-slot']}>
          <MainSidebarToggle className={styles['sidebar-toggle']}>
            <ion-icon name="menu-outline"></ion-icon>
          </MainSidebarToggle>
          <div className={styles.divider}></div>
          <div className={styles['pipeline-detail']}>
            <Link href="/pipelines">Pipelines</Link>
            <div className={styles.divider}></div>
            <div className={"nowrap"}>{pipelineName}</div>
            <div className={`${styles.divider} ${styles.last}`}></div>
            <div className={styles['nodes-edges']}>
              <span className="nowrap">{nodes.length} stages</span>
              <span>&bull;</span>
              <span className="nowrap">{edges.length} connections</span>
            </div>
          </div>
        </div>
        <div className={styles['center-slot']}>
          <EnvironmentSelect environments={environments} />
        </div>
        <div className={styles['right-slot']}>
          <HeaderButtons />
        </div>
      </div>
    </header >
  )
}