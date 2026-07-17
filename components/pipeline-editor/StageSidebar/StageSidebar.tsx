import styles from './stage-sidebar.module.css';
import StageConfigForm from './StageConfigForm';
import DeleteStageButton from './DeleteStageButton';
import type { Node } from '@xyflow/react';

interface StageSidebarProps {
  node: Node | undefined;
  setStageSidebarOpen: (state: boolean) => void;
}

export default function StageSidebar({ node, setStageSidebarOpen }: StageSidebarProps) {

  if (!node) return;

  return (
    <>
      <div className={styles['stage-sidebar-header']}>
        <div className={styles['stage-title']}>
          <div className={styles.title}>Configure Stage</div>
        </div>
        <button type="button" className={styles['exit-btn']} onClick={() => setStageSidebarOpen(false)} aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <StageConfigForm key={node.id} node={node} />

      <div className={styles['delete-stage']}>
        <DeleteStageButton className={styles["delete-btn"]} />
      </div>
    </>
  )
}
