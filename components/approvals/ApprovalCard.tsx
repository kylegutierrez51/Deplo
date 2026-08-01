import styles from './approval-card.module.css'
import ApprovalMeta from './ApprovalMeta';
import ApprovalActions from './ApprovalActions';
import Pill from '@/components/Pill';
import { Stage } from '@/lib/data/approvals';
import type { EnvType } from '@/lib/types';
import { capitalize } from '@/lib/utils/string';

interface ApprovalCardProps {
  runId: string;
  pipelineName: string;
  environment: { type: EnvType; name: string } | null;
  commitSha: string | null;
  commitMessage: string | null;
  createdBy: string | null;
  branch: string | null;
  waitingTime: string;
  stages: Stage[];
}

export default function ApprovalCard({ runId, pipelineName, environment, commitSha, commitMessage, createdBy, branch, waitingTime, stages }: ApprovalCardProps) {
  const stagesComplete = String(stages.filter(stage => stage.status === "succeeded").length);

  return (
    <div className={styles['approval-card']} data-approval-card>

      <div className={styles['approval-card-row']}>
        <div className={styles['approvals-detail']}>
          <div className={styles['top-row']}>
            <span>{pipelineName}</span>
            {environment ? (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <div className={styles['environment']}>
                  <span className={styles['env-name']}>{environment.name}</span>
                  <Pill variant={environment.type} label={capitalize(environment.type)} />
                </div>
              </>
            ) : (
              <Pill variant="idle" label="None" />
            )}
          </div>
          <div className={styles['feature-info']}>
            <div className={styles['feature-id']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              <span>{commitSha ?? 'None'}</span>
            </div>
            <span className={styles.feature}>{commitMessage ?? 'No commit message'}</span>
          </div>

          <ApprovalMeta
            createdBy={createdBy} branch={branch}
            waitingTime={waitingTime} stagesComplete={stagesComplete + '/' + stages.length}
          />
        </div>

        <ApprovalActions runId={runId} />
      </div>
    </div>
  )
}