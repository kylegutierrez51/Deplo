import styles from './stage-sidebar.module.css';
import StageConfigForm from './StageConfigForm';
import DeleteStageButton from './DeleteStageButton';
import { StageCloseButton } from '../PipelineEditorChrome';

export default function StageSidebar() {
  return (
    <>
      <div className={styles['stage-sidebar-header']}>
        <div className={styles['stage-title']}>
          <div className={styles.title}>Configure Stage</div>
        </div>
        <StageCloseButton className={styles['exit-btn']}>
          <ion-icon name="close-outline"></ion-icon>
        </StageCloseButton>
      </div>

      <StageConfigForm />

      <div className={styles['delete-stage']}>
        <DeleteStageButton className={styles["delete-btn"]} />
      </div>
    </>
  )
}
