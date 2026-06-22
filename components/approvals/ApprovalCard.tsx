import { Fragment } from 'react';
import styles from './approval-card.module.css'
import ApprovalMeta from './ApprovalMeta';
import ApprovalActions from './ApprovalActions';
import StageNode from './StageNode';
import Pill from '@/components/Pill';
import HideStagesButton from './HideStagesButton';
import { Stage } from '@/lib/data/approvals';

interface ApprovalCardProps {
  runId: number;
  pipelineName: string;
  environment: string;
  commitSha: string;
  commitMessage: string;
  createdBy: string | null;
  branch: string;
  waitingTime: string;
  stages: Stage[];
}

export default function ApprovalCard({ runId, pipelineName, environment, commitSha, commitMessage, createdBy, branch, waitingTime, stages }: ApprovalCardProps) {
  const stagesComplete = String(stages.filter(stage => stage.status === "succeeded").length);

  return (
    <div className={styles['approval-card']} data-approval-card>

      <div className={styles['approval-card-row']}>

        <div className={styles['approvals-detail']}>
          <div className={styles['pipeline-name-type']}>
            <span>{pipelineName}</span>
            <Pill variant="production" label={environment} />
          </div>
          <div className={styles['feature-info']}>
            <div className={styles['feature-id']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              <span>{commitSha}</span>
            </div>
            <span className={styles.feature}>{commitMessage}</span>
          </div>

          <ApprovalMeta
            createdBy={createdBy} branch={branch}
            waitingTime={waitingTime} stagesComplete={stagesComplete + '/' + stages.length}
          />
        </div>

        <ApprovalActions runId={runId} />

        <div className={styles['stage-view']}>
          <HideStagesButton />
        </div>
      </div>

      <div className={styles.stages} data-stages-row>
        <div className={styles['stages-row']}>
          {stages.map((stage, i) => (
            <Fragment key={stage.id}>
              <StageNode
                name={stage.name}
                stageType={stage.stageType}
                status={stage.status}
                isApproval={stage.isApproval}
              />
              {i < stages.length - 1 && <span>→</span>}
            </Fragment>
          ))}
        </div>
      </div>

    </div>
  )
}