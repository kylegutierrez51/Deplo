import styles from './pipeline-graph.module.css'

export default function ConnectorFork() {
  return (
    <div className={styles['connector-fork']}>
      <div className={styles['cf-stem']}></div>
      <div className={styles['cf-arms']}>
        <div className={styles['cf-spacer']}></div>
        <div className={`${styles['cf-arm']} ${styles['cf-arm-left']}`}></div>
        <div className={`${styles['cf-arm']} ${styles['cf-arm-right']}`}></div>
        <div className={styles['cf-spacer']}></div>
      </div>
    </div>
  );
}
