import styles from './stage-node.module.css'
import { StageType, StageStatus } from '@/lib/data/approvals';

// add OnApprove and OnReject: () => void;
interface StageNodeProps {
  name: string;
  stageType: StageType;
  status: StageStatus;
  isApproval?: boolean;
}

const STAGE_TYPE_ICONS: Record<StageType, string> = {
  build: 'hammer-outline',
  test: 'flask-outline',
  deploy: 'rocket-outline',
  approval: 'shield-outline',
  script: 'code-outline',
};

const STATUS_ICONS: Record<StageStatus, string> = {
  pending: 'time-outline',
  queued: 'time-outline',
  running: 'sync-outline',
  succeeded: 'checkmark-circle-outline',
  approved: 'checkmark-circle-outline',
  failed: 'close-circle-outline',
  unapproved: 'close-circle-outline',
  cancelled: 'close-circle-outline',
  awaiting_approval: 'alert-circle-outline',
};

export default function StageNode({ name, stageType, status, isApproval = false }: StageNodeProps) {
  const stageTypeIcon = STAGE_TYPE_ICONS[stageType];
  const statusIcon = STATUS_ICONS[status];


  return (
    <div className={`${styles.stage} ${isApproval ? `${styles.approval}` : ''}`}>
      <ion-icon name={stageTypeIcon}></ion-icon>
      <span>{name}</span>
      <ion-icon name={statusIcon}></ion-icon>
    </div>
  )
}