import type { CSSProperties } from 'react';
import styles from './stat-cards.module.css';

interface StatCard {
  icon: string;
  total: string | number;
  label: string;
  scope: string;
  tone: 'running' | 'queued' | 'approval' | 'failed' | 'pending' | 'processed' | 'ignored';
}

interface StatCardsProps {
  cards: StatCard[];
  ariaLabel: string;
}

export default function StatCards({ cards, ariaLabel }: StatCardsProps) {
  return (
    <dl className={styles['cards-row']} aria-label={ariaLabel} style={{ '--stat-columns': cards.length } as CSSProperties}>
      {cards.map(stat => (
        <div className={styles.stat} key={stat.label}>
          <dt><ion-icon name={stat.icon} aria-hidden="true"></ion-icon>{stat.label}</dt>
          <dd className={styles[stat.tone]}>{stat.total}<span className={styles['stat-scope']}>{stat.scope}</span></dd>
        </div>
      ))}
    </dl>
  );
}
