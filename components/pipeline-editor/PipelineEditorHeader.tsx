import Link from 'next/link';
import styles from './pipeline-editor-header.module.css'
import FilterSelect from '../filters/FilterSelect';
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
        <HeaderButtons />
      </div>
    </header>
  )
}