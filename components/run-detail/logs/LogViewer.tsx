import styles from './log-viewer.module.css'
import LogLine from './LogLine';

type Status = 'succeeded' | 'failed' | 'running';
type LogLineData = { lineNumber: number, timestamp: string, content: string };

interface LogViewerProps {
  jobName: string;
  command: string;
  status: Status;
  duration: string;
  lines: LogLineData[];
}

const iconName: Record<Status, string> = {
  succeeded: 'checkmark-circle-outline',
  running:   'sync-outline',
  failed:    'close-circle-outline',
};

const footerText: Record<Status, string> = {
  succeeded: 'Process exited with code 0',
  failed:    'Process exited with code 1',
  running:   'Running...',
};

export default function LogViewer({ jobName, command, status, duration, lines }: LogViewerProps) {
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
            timestamp={line.timestamp}
            content={line.content}
            logPrompt={line.content === command}
          />
        ))}
      </div>

      <div className={styles['log-footer']}>
        <span className={styles[status]}>{footerText[status]}</span>
      </div>

    </div>
  )
}