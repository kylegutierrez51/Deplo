import styles from './approval.module.css'
import ApprovalMeta from './ApprovalMeta';
import ApprovalActions from './ApprovalActions';
import Pill from '@/components/ui/Pill';
import type { EnvType } from '@/lib/types';
import { capitalize, truncateText } from '@/lib/utils/string';
import { shortSha, commitSummary } from '@/lib/utils/git';

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
    <article className={styles['approval-card']} data-approval-card aria-label={`${pipelineName}${runNumber ? ` run #${runNumber}` : ''}: ${stageName}`}>

      <div className={styles['approval-card-row']}>
        <div className={styles['approvals-detail']}>
          <div className={styles['top-row']}>
            <h2 className={styles['pipeline-name']}>{pipelineName}</h2>
            {runNumber && <span className={styles['run-num']}>#{runNumber}</span>}
            {environment ? (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles['environment']}>
                  <span className={styles['env-name']} title={environment.name}>{truncateText(environment.name)}</span>
                  <Pill variant={environment.type} label={capitalize(environment.type)} />
                </div>
              </>
            ) : (
              <Pill variant="idle" label="None" />
            )}
          </div>

          <div className={styles['feature-info']}>
            <p className={styles['stage-name']}><ion-icon name="shield-checkmark-outline" aria-hidden="true"></ion-icon>{stageName}</p>
            {commitSha &&
              <div className={styles['feature-id']}>
                <ion-icon name="git-commit-outline"></ion-icon>
                <span title={commitSha}>{shortSha(commitSha)}</span>
              </div>
            }
            {commitMessage && <span className={styles.feature} title={commitMessage}>{commitSummary(commitMessage)}</span>}

          </div>

          <ApprovalMeta
            createdBy={truncateText(createdBy)} branch={truncateText(branch)}
            waitingTime={waitingTime} stagesComplete={stagesComplete}
          />
        </div>

        <ApprovalActions id={id} runId={runId} stageId={stageId} env={environment} />
      </div>
    </article>
  )
}