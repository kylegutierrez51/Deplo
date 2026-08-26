import styles from './approval.module.css'
import ApprovalMeta from './ApprovalMeta';
import ApprovalActions from './ApprovalActions';
import Pill from '@/components/ui/Pill';
import type { EnvType } from '@/lib/types';
import { capitalize, truncateText } from '@/lib/utils/string';

interface ApprovalCardProps {
  id: string;
  stageId: string;
  runId: string;
  pipelineName: string;
  runNumber: number | null;
  stageName: string;
  environment: { type: EnvType; name: string } | null;
  commitSha: string | null;
  commitMessage: string | null;
  createdBy: string | null;
  branch: string | null;
  waitingTime: string;
  stagesComplete: string;
}

export default function ApprovalCard({ id, stageId, runId, pipelineName, runNumber, stageName, environment, commitSha, commitMessage, createdBy, branch, waitingTime, stagesComplete }: ApprovalCardProps) {

  return (
    <div className={styles['approval-card']} data-approval-card>

      <div className={styles['approval-card-row']}>
        <div className={styles['approvals-detail']}>
          <div className={styles['top-row']}>
            <span>{pipelineName}</span>
            {runNumber && <span className={styles['run-num']}>#{runNumber}</span>}
            {environment ? (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles['environment']}>
                  <span className={styles['env-name']}>{truncateText(environment.name)}</span>
                  <Pill variant={environment.type} label={capitalize(environment.type)} />
                </div>
              </>
            ) : (
              <Pill variant="idle" label="None" />
            )}
          </div>

          <div className={styles['feature-info']}>
            <p className={styles['stage-name']}>{stageName}</p>
            <div className={styles['feature-id']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              <span>{commitSha ?? 'None'}</span>
            </div>
            <span className={styles.feature}>{truncateText(commitMessage) ?? 'No Commit Message'}</span>
          </div>

          <ApprovalMeta
            createdBy={truncateText(createdBy)} branch={truncateText(branch)}
            waitingTime={waitingTime} stagesComplete={stagesComplete}
          />
        </div>

        <ApprovalActions id={id} runId={runId} stageId={stageId} env={environment} />
      </div>
    </div>
  )
}