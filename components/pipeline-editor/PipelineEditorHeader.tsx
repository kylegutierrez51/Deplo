import Link from 'next/link';
import styles from './pipeline-editor-header.module.css'
import HeaderButtons from './HeaderButtons';
import { MainSidebarToggle } from './PipelineEditorChrome';

interface PipelineEditorHeaderProps {
  pipelineName: string,
  stageCount: number,
  connectionCount: number;
}
export default function PipelineEditorHeader({ pipelineName, stageCount, connectionCount }: PipelineEditorHeaderProps) {
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
              <span className="nowrap">{stageCount} stages</span>
              <span>&bull;</span>
              <span className="nowrap">{connectionCount} connections</span>
            </div>
          </div>
        </div>
        <HeaderButtons />
      </div>
    </header>
  )
}