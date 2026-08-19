import styles from './log-line.module.css';

interface LogLineProps {
  lineNumber: number;
  content: string;
}

export default function LogLine({ lineNumber, content }: LogLineProps) {
  return (
    <div className={styles['log-line']}>
      <span className={styles['log-num']}>{lineNumber}</span>
      <span className={styles['log-content']}>
        {content}
      </span>
    </div>
  )
}