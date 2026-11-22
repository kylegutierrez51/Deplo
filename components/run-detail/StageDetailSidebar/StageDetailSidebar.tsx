import detailStyles from './stage-detail-sidebar.module.css';
import panelStyles from '@/components/ui/stage-panel.module.css';
import StageDetailView from './StageDetailView';
import type { StageResultNode } from '@/lib/data/run-detail';


const styles = { ...panelStyles, ...detailStyles };

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
          <span className={styles['icon-border']}><ion-icon name="options-outline"></ion-icon></span>
          <div>
            <h2 className={styles.title}>Stage details</h2>
            <p className={styles['stage-caption']}>{node.data.name || 'New stage'}</p>
          </div>
        </div>
        <button type="button" className={styles['exit-btn']} onClick={onClose} aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <StageDetailView key={node.id} node={node} envPresent={envPresent} />
    </>
  )
}
