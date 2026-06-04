import styles from './approval-card.module.css'
import ApprovalMeta from './ApprovalMeta';
import ApprovalActions from './ApprovalActions';
import StageNode from './StageNode';

interface ApprovalCardProps {
  pipelineName: string;
  environment: string;
  triggerType: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  branch: string;
  waitingTime: string;
  stagesComplete: string;
  stages: { name: string, icon: string, statusIcon: string, notLast: boolean, isApproval?: boolean }[];
  runHref: string;
}

export default function ApprovalCard({ pipelineName, environment, triggerType, commitHash, commitMessage, author, branch, waitingTime, stagesComplete, runHref, stages }: ApprovalCardProps) {
  return (
    <div className={styles['approval-card']}>

      <div className={styles['approval-card-row']}>

        <div className={styles['approvals-detail']}>
          <div className={styles['pipeline-name-type']}>
            <span>{pipelineName}</span>
            <div className="pill pill--production">{environment}</div>
            <div className="pill pill--manual">{triggerType}</div>
          </div>
          <div className={styles['feature-info']}>
            <div className={styles['feature-id']}>
              <ion-icon name="git-commit-outline"></ion-icon>
              <span>{commitHash}</span>
            </div>
            <span className={styles.feature}>{commitMessage}</span>
          </div>

          <ApprovalMeta
            author={author} branch={branch}
            waitingTime={waitingTime} stagesComplete={stagesComplete}
          />
        </div>

        <ApprovalActions runHref={runHref} />

        <div className={styles['stage-view']}>
          <div>
            <ion-icon name="chevron-down-outline"></ion-icon>
            <span>Hide stages</span>
          </div>
        </div>
      </div>

      <div className={styles.stages}>
        <div className={styles['stages-row']}>
          {stages.map((stage, index) => (
            <StageNode
              icon={stage.icon}
              name={stage.name}
              statusIcon={stage.statusIcon}
              notLast={stage.notLast}
              isApproval={stage.isApproval}
              key={index}
             />
          ))}
        </div>
      </div>

    </div>
  )
}