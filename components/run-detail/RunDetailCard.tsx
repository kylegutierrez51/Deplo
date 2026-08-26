import styles from './run-detail-card.module.css'
import RunDetailActions from './RunDetailActions';
import Pill from '@/components/ui/Pill';
import { capitalize } from '@/lib/utils/string';
import type { RunStatus, EnvType } from '@/lib/types';

interface RunDetailCardProps {
  id: string;
  pipelineName: string;
  runNumber: number;
  status: RunStatus;
  environment: { type: EnvType; name: string } | null;
  commitHash: string;
  commitMessage: string;
  branch: string;
  repo: string;
  trigger: string;
  triggeredBy: string;
  duration: string;
  timeAgo: string;
}

export default function RunDetailCard({ id, pipelineName, runNumber, status, environment, commitHash, commitMessage, branch, repo, trigger, triggeredBy, duration, timeAgo }: RunDetailCardProps) {
  return (
    <div className={styles['run-detail-card']}>
      <div className={styles['rdc-inner']}>

        <div className={styles['rdc-info']}>
          {/* Row 1: name, run number, status, environment */}
          <div className={styles['rdc-title-row']}>
            <span className={styles['rdc-name']}>{pipelineName}</span>
            <span className={styles['rdc-num']}>#{runNumber}</span>
            <span className={styles.divider} aria-hidden="true" />
            <div className={styles['rdc-status']}>
              {status === 'running' && 
                <ion-icon name='sync-outline' className={styles.running}></ion-icon>
              }
              <Pill variant={status} label={capitalize(status)} />
            </div>
            {environment ? (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles['rdc-env-detail']}>
                  <span className={styles['rdc-meta-item']}>{environment.name}</span>
                  <Pill variant={environment.type} label={capitalize(environment.type)} />
                </div>
              </>
            ) : (
              <span className={styles['rdc-meta-item']}>No Environment Found</span>
            )}
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
              <span>Duration: {duration}</span>
            </div>
            <div className={styles['rdc-meta-item']}>
              <ion-icon name="time-outline"></ion-icon>
              <span>Triggered {timeAgo} ago</span>
            </div>
          </div>
        </div>

        <RunDetailActions id={id} status={status} env={environment} />

      </div>
    </div>
  )
}
