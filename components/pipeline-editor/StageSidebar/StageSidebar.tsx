import styles from './stage-sidebar.module.css';
import StageConfigForm from './StageConfigForm';
import type { CustomNode } from '@/lib/types';

interface StageSidebarProps {
  node: CustomNode | undefined;
  setStageSidebarOpen: (state: boolean) => void;
}

export default function StageSidebar({ node, setStageSidebarOpen }: StageSidebarProps) {

  if (!node) return;

  return (
    <>
      <div className={styles['stage-sidebar-header']}>
        <div className={styles['stage-title']}>
          <span className={styles['icon-border']}><ion-icon name="options-outline"></ion-icon></span>
          <div>
            <h2 className={styles.title}>Configure stage</h2>
            <p className={styles['stage-caption']}>{node.data.name || 'New stage'}</p>
          </div>
        </div>
        <button type="button" className={styles['exit-btn']} onClick={() => setStageSidebarOpen(false)} aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <StageConfigForm key={node.id} node={node} />
    </>
  )
}
