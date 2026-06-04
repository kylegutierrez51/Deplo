import styles from './run-detail-card.module.css'
import RunDetailActions from './RunDetailActions';

/*
onCancel: () => void; 
onRerun: () => void
*/
interface RunDetailCardProps {
  pipelineName: string; 
  runNumber: number; 
  status: string; 
  environment: string; 
  commitHash: string; 
  commitMessage: string; 
  branch: string; 
  repo: string; 
  trigger: string; 
  triggeredBy: string; 
  duration: string; 
  timeAgo: string; 
}

export default function RunDetailCard({ pipelineName, runNumber, status, environment, commitHash, commitMessage, branch, repo, trigger, triggeredBy, duration, timeAgo }: RunDetailCardProps) {
  return (
    <div className={styles['run-detail-card']}>
      <div className={styles['rdc-inner']}>

        <div className={styles['rdc-info']}>
          {/* Row 1: name, run number, status, environment */}
          <div className={styles['rdc-title-row']}>
            <span className={styles['rdc-name']}>{pipelineName}</span>
            <span className={styles['rdc-num']}>#{runNumber}</span>
            <div className={`${styles['rdc-status']} ${styles.running} pill pill--running`}>
              <ion-icon name="sync-outline"></ion-icon>
              {status}
            </div>
            <div className="pill pill--production">{environment}</div>
          </div>

          {/* Row 2: commit info */}
          <div className={styles['rdc-commit-row']}>
            <div className={styles['rdc-commit-ref']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              <span className={styles['rdc-commit-hash']}>{commitHash}</span>
            </div>
            <span className={styles['rdc-commit-msg']}>{commitMessage}</span> {/*30 chars should fit */}
            <div className={styles['rdc-meta-item']}>
              <ion-icon name="git-branch-outline"></ion-icon>
              <span>{branch}</span>
            </div>
            <div className={`${styles['rdc-meta-item']} ${styles['rdc-link']}`}>
              <ion-icon name="open-outline"></ion-icon>
              <span>{repo}</span>
            </div>
          </div>

          {/* Row 3: trigger info */}
          <div className={styles['rdc-trigger-row']}>
            <div className={styles['rdc-meta-item']}>
              <ion-icon name="flash-outline"></ion-icon>
              <span>Triggered by {trigger} <span className={styles['rdc-user']}>({triggeredBy})</span></span>
            </div>
            <div className={styles['rdc-meta-item']}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <span>{duration}</span>
            </div>
            <div className={styles['rdc-meta-item']}>
              <ion-icon name="time-outline"></ion-icon>
              <span>{timeAgo} ago</span>
            </div>
          </div>
        </div>

        <RunDetailActions/>

      </div>
    </div>
  )
}