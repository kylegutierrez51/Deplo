"use client"

import styles from './webhook-card.module.css'

interface WebhookCardProps {
  repo: string;
  status: 'Active' | 'Inactive';
  triggers: string[];
  lastDelivery: string;
  registeredAgo: string;
  branchFilters?: string[];
}
export default function WebhookCard({ repo, status, triggers, lastDelivery, registeredAgo, branchFilters }: WebhookCardProps) {
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
              <div className={`${status === 'Active' ? ` ${styles.active}` : ` ${styles.inactive}`} `}>{status}</div>
            </div>
            <div className={styles.triggers}>
              {triggers.map((event, index) => (
                <div className={styles['trigger-type']} key={index}>{event}</div>
              ))}
            </div>
            <div className={styles.time}>
              <div className={styles['last-delivery']}>
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                <span>{lastDelivery} ago</span>
              </div>
              <span>&bull;</span>
              <span className={styles.registered}>{registeredAgo} ago</span>
            </div>
            {branchFilters && 
            <div className={styles.branchFilters}>
              <span>Branch Filters:</span>
              <div className={styles.branchPills}>
                {branchFilters?.map((branchFilter, index) => (
                  <span key={index} className={styles.branchPill}>{branchFilter}</span>
                ))}
              </div>
            </div>
            }
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