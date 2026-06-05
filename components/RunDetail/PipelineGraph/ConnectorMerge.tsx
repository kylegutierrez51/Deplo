import styles from './pipeline-graph.module.css'

export default function ConnectorMerge() {
  return (
    <div className={styles['connector-merge']}>
      <div className={styles['cm-arms']}>
        <div className={styles['cm-spacer']}></div>
        <div className={`${styles['cm-arm']} ${styles['cm-arm-left']}`}></div>
        <div className={`${styles['cm-arm']} ${styles['cm-arm-right']}`}></div>
        <div className={styles['cm-spacer']}></div>
      </div>
      <div className={styles['cm-stem']}></div>
    </div>
  );
}
