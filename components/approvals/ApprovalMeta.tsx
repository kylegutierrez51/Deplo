import styles from './approval-meta.module.css'

interface ApprovalMetaProps {
  createdBy: string | null;
  branch: string | null;
  waitingTime: string;
  stagesComplete: string;
}
export default function ApprovalMeta({ createdBy, branch, waitingTime, stagesComplete }: ApprovalMetaProps) {
  return (
    <div className={styles['extra-info']}>
      <div className={styles['meta-row']}>
        <ion-icon name="person-outline"></ion-icon>
        <span>{createdBy || 'Unknown Creator'}</span>
      </div>
      <div className={styles['meta-row']}>
        <ion-icon name="git-branch-outline"></ion-icon>
        <span>{branch ?? 'None'}</span>
      </div>
      <div className={styles['meta-row']}>
        <ion-icon name="stopwatch-outline"></ion-icon>
        <span>Waiting <span className={styles['waiting-time']}>{waitingTime}</span></span>
      </div>
      <div className={styles['meta-row']}>
        <ion-icon name="caret-forward-outline"></ion-icon>
        <span>{stagesComplete} stages complete</span>
      </div>
    </div>
  )
}