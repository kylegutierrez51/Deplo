import styles from './runner-status-banner.module.css';
import type { RunnerAvailability } from '@/lib/types';

type Unavailable = Extract<RunnerAvailability, { available: false }>;

// no-workers: 'npm run runner' hasn't started
// unreachable: redis is down
const COPY: Record<Unavailable['reason'], { title: string, detail: string }> = {
  'no-workers': {
    title: 'Runner Not Available',
    detail: 'No runner process is consuming the queue, so this run will not progress until one is started.',
  },
  unreachable: {
    title: 'Queue Unreachable',
    detail: 'The job queue could not be reached, so this run will not progress and new runs cannot be triggered.',
  },
};

export default function RunnerStatusBanner({ reason }: { reason: Unavailable['reason'] }) {
  const { title, detail } = COPY[reason];

  return (
    <div className={styles.banner} role="status">
      <ion-icon name="warning-outline" aria-hidden="true"></ion-icon>

      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.detail}>{detail}</span>
      </div>
    </div>
  );
}
