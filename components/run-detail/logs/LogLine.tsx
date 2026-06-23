import styles from './log-line.module.css'

interface LogLineProps {
  lineNumber: number;
  timestamp: string;
  content: string;
  logPrompt: boolean;
}

export default function LogLine({ lineNumber, timestamp, content, logPrompt = false }: LogLineProps) {
  return (
    <div className={styles['log-line']}>
      <span className={styles['log-num']}>{lineNumber}</span>
      <span className={styles['log-time']}>{timestamp}</span>
      <span className={styles['log-content']}> 
        {logPrompt && <span className={styles['log-prompt']}>$ </span>}
        {content}
      </span>
    </div>
  )
}