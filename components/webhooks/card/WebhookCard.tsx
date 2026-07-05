import styles from './webhook-card.module.css'
import SyncButton from './SyncButton';
import type { Webhook } from "@/lib/data/webhooks";
import { formatDate } from '@/lib/utils/string';

export default function WebhookCard({ webhook }: { webhook: Webhook}) {
  return (
    <div className={styles['webhook-card']}>
      <div className={styles['webhook-row']}>
        <div className={styles['webhook-detail']}>
          <div className={styles['git-icon']}>
            <ion-icon name="git-branch-outline"></ion-icon>
          </div>
          <div className={styles['pipeline-info']}>
            <div className={styles['name-status']}>
              <div className={styles.name}>{webhook.repo}</div>
              <div className={`${webhook.isActive ? ` ${styles.active}` : ` ${styles.inactive}`} `}>{webhook.isActive ? 'Active' : 'Inactive' }</div>
            </div>
            <div className={styles.events}>
              {webhook.events.map((event, index) => (
                <div className={styles['event-type']} key={index}>{event}</div>
              ))}
            </div>
            <div className={styles.time}>
              {webhook.lastDelivery &&
                <>
                  <div className={styles['last-delivery']}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    <span>{formatDate(webhook.lastDelivery)}</span>
                  </div>
                </>
              }
            </div>
            {webhook.branchFilters.length > 0  &&
              <div className={styles.branchFilters}>
                <span>Branch Filters:</span>
                <div className={styles.branchPills}>
                  {webhook.branchFilters?.map((branchFilter, index) => (
                    <span key={index} className={styles.branchPill}>{branchFilter}</span>
                  ))}
                </div>
              </div>
            }
          </div>
        </div>
        <SyncButton id={webhook.id} />
      </div>
    </div>
  )
}