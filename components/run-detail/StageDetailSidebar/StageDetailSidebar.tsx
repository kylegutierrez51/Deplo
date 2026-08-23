import styles from './stage-detail-sidebar.module.css';
import StageDetailView from './StageDetailView';
import type { StageResultNode } from '@/lib/data/run-detail';

interface StageDetailSidebarProps {
  node: StageResultNode | undefined;
  envPresent: boolean;
  onClose: () => void;
}

export default function StageDetailSidebar({ node, envPresent, onClose }: StageDetailSidebarProps) {
  if (!node) return null;

  return (
    <>
      <div className={styles['stage-sidebar-header']}>
        <div className={styles['stage-title']}>
          <div className={styles.title}>Stage Details</div>
        </div>
        <button type="button" className={styles['exit-btn']} onClick={onClose} aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <StageDetailView key={node.id} node={node} envPresent={envPresent} />
    </>
  )
}
