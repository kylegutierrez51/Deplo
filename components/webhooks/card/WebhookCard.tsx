import styles from './webhook-card.module.css'
import SyncButton from './SyncButton';

interface WebhookCardProps {
  id: number;
  repo: string;
  status: boolean;
  events: string[];
  lastDelivery?: string;
  registeredAgo: string;
  branchFilters?: string[];
}
export default function WebhookCard({ id, repo, status, events, lastDelivery, registeredAgo, branchFilters }: WebhookCardProps) {
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
              <div className={`${status ? ` ${styles.active}` : ` ${styles.inactive}`} `}>{status ? 'Active' : 'Inactive' }</div>
            </div>
            <div className={styles.events}>
              {events.map((event, index) => (
                <div className={styles['event-type']} key={index}>{event}</div>
              ))}
            </div>
            <div className={styles.time}>
              {lastDelivery &&
                <>
                  <div className={styles['last-delivery']}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    <span>{lastDelivery} ago</span>
                  </div>
                  <span>&bull;</span>
                </>
              }
              <span className={styles.registered}>Registered: {registeredAgo} ago</span>
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
        <SyncButton id={id} />
      </div>
    </div>
  )
}