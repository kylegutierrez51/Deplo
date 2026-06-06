"use client"

import styles from './webhook-card.module.css'

interface WebhookCardProps {
  repo: string;
  status: 'Active' | 'Inactive';
  events: string[];
  secretPreview: string;
  lastDelivery: string;
  registeredAgo: string;
}
export default function WebhookCard({ repo, status, events, secretPreview, lastDelivery, registeredAgo }: WebhookCardProps) {
  return (
    <div className={styles['webhook-card']}>
      <div className={styles['webhook-row']}>
        <div className={styles['webhook-detail']}>
          <div className={styles['git-icon']}>
            <ion-icon name="git-branch-outline"></ion-icon>
          </div>
          <div className={styles['pipeline-info']}>
            <div className={styles['name-status']}>
              <div className={styles.name}>{repo}</div>
              <div className={styles.active}>{status}</div>
            </div>
            <div className={styles.events}>
              {events.map((event, index) => (
                <div className={styles['event-type']} key={index}>{event}</div>
              ))}
            </div>
            <div className={styles.secret}>
              <span>Secret:</span>
              <span className={styles['secret-val']}>{secretPreview}</span>
              <ion-icon name="eye-outline"></ion-icon>
              <ion-icon name="copy-outline"></ion-icon>
            </div>
            <div className={styles.time}>
              <div className={styles['last-delivery']}>
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                <span>{lastDelivery} ago</span>
              </div>
              <span>&bull;</span>
              <span className={styles.registered}>{registeredAgo} ago</span>
            </div>
          </div>
        </div>
        <div className={styles.options}>
          <ion-icon name="sync-outline"></ion-icon>
          <ion-icon name="trash-outline"></ion-icon>
        </div>
      </div>
    </div>
  )
}