import styles from './pipeline-graph.module.css'
import Pill, { type PillVariant } from '@/components/Pill';

export interface JobNodeProps {
  name: string;
  statusIcon: string;
  status: string;
  duration?: string;
  isActive?: boolean;
}

export default function JobNode({ name, statusIcon, status, duration }: JobNodeProps) {
  const iconClass =
    status === 'running' ? styles['job-icon-running'] :
    status === 'queued' || status === 'pending' ? styles['job-icon-pending'] :
    undefined;

  return (
    <div className={styles.job}>
      <div className={styles['job-name']}>
        <span>{name}</span>
        <ion-icon name={statusIcon} className={iconClass}></ion-icon>
      </div>
      <div className={styles['job-status-time']}>
        <Pill
          variant={status as PillVariant}
          label={status.charAt(0).toUpperCase() + status.slice(1)}
        />
        {duration && <span>{duration}</span>}
      </div>
    </div>
  );
}
