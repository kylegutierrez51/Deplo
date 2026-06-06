import styles from './pipeline-graph.module.css'
import JobNode, { type JobNodeProps } from './JobNode'
import ConnectorStraight from './ConnectorStraight'
import ConnectorFork from './ConnectorFork'
import ConnectorMerge from './ConnectorMerge'

export type PipelineNode =
  | ({ type: 'job' } & JobNodeProps)
  | { type: 'connector-straight'; active?: boolean }
  | { type: 'connector-fork' }
  | { type: 'connector-merge' }
  | { type: 'parallel'; jobs: JobNodeProps[] };

interface PipelineGraphProps {
  nodes: PipelineNode[];
}

export default function PipelineGraph({ nodes }: PipelineGraphProps) {
  return (
    <div className={styles.pipeline}>
      <div className={styles['pipeline-inner']}>
        {nodes.map((node, i) => {
          switch (node.type) {
            case 'job':
              return <JobNode key={i} name={node.name} statusIcon={node.statusIcon} status={node.status} duration={node.duration} isActive={node.isActive} />;
            case 'connector-straight':
              return <ConnectorStraight key={i} active={node.active} />;
            case 'connector-fork':
              return <ConnectorFork key={i} />;
            case 'connector-merge':
              return <ConnectorMerge key={i} />;
            case 'parallel':
              return (
                <div key={i} className={styles['parallel-row']}>
                  {node.jobs.map((job, j) => (
                    <JobNode key={j} name={job.name} statusIcon={job.statusIcon} status={job.status} duration={job.duration} isActive={job.isActive} />
                  ))}
                </div>
              );
          }
        })}
      </div>
    </div>
  );
}
