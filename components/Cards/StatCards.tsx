import styles from './stat-cards.module.css'

interface StatCardsProps {
  cards: {
    icon: string;
    total: string | number;
    label: string;
    valueClassName?: string;
  }[],
  responsive?: boolean
}

export default function StatCards({ cards, responsive=true }: StatCardsProps) {
  return (
    <div className={`${styles['cards-row']}${responsive ? ` ${styles.responsive}` : ''}`}>
      {cards.map((card, index) => (
      <div className={styles.card} key={index}>
        <ion-icon name={card.icon}></ion-icon>
        <div className={styles['card-detail']}>
          <span className={`${styles['card-total']} ${card.valueClassName ? ` ${styles[card.valueClassName]}` : ''}`}>{card.total}</span>
          <span className={styles['card-name']}>{card.label}</span>
        </div>
      </div>
      ))}
    </div>
  )
}