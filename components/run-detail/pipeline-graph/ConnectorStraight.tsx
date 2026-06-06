import styles from './pipeline-graph.module.css'

interface ConnectorStraightProps {
  active?: boolean;
}

export default function ConnectorStraight({ active = false }: ConnectorStraightProps) {
  return (
    <div className={`${styles['connector-straight']} ${active ? styles.active : ''}`}></div>
  );
}
