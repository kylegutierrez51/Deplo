import styles from './overview-stats.module.css';

interface OverviewStat {
  icon: string;
  total: number;
  label: string;
  scope: string;
  tone: 'running' | 'queued' | 'approval' | 'failed' | 'pending' | 'processed' | 'ignored';
}

interface OverviewStatsProps {
  cards: OverviewStat[];
  ariaLabel: string;
}

export default function OverviewStats({ cards, ariaLabel }: OverviewStatsProps) {
  return (
    <dl className={styles['cards-row']} aria-label={ariaLabel}>
      {cards.map(stat => (
        <div className={styles.stat} key={stat.label}>
          <dt><ion-icon name={stat.icon} aria-hidden="true"></ion-icon>{stat.label}</dt>
          <dd className={styles[stat.tone]}>{stat.total}<span className={styles['stat-scope']}>{stat.scope}</span></dd>
        </div>
      ))}
    </dl>
  );
}
