import styles from './log-viewer.module.css'
import LogLine from './LogLine';
import type { JobLog, LogStatus } from '@/lib/data/run-detail';


const iconName: Record<LogStatus, string> = {
  succeeded: 'checkmark-circle-outline',
  running:   'sync-outline',
  failed:    'close-circle-outline',
};

const footerText: Record<LogStatus, string> = {
  succeeded: 'Process exited with code 0',
  failed:    'Process exited with code 1',
  running:   'Running...',
};

export default function LogViewer({ log }: { log: JobLog }) {
  const { status, jobName, command, duration, lines } = log;

  return (
    <div className={styles['log-viewer']}>

      <div className={styles['log-header']}>
        <div className={styles['log-header-left']}>
          <ion-icon name={iconName[status]} className={`${styles['log-job-icon']} ${styles[status]}`}></ion-icon>
          <span className={styles['log-job-name']}>{jobName}</span>
          <span className={styles['log-job-cmd']}>{command}</span>
        </div>
        <span className={styles['log-duration']}>{duration}</span>
      </div>

      <div className={styles['log-body']}>
        {lines.map((line, index) => (
          <LogLine
            key={index}
            lineNumber={line.lineNumber}
            content={line.content}
          />
        ))}
      </div>

      <div className={styles['log-footer']}>
        <span className={styles[status]}>{footerText[status]}</span>
      </div>

    </div>
  )
}