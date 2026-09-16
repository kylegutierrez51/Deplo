import Link from 'next/link';
import styles from './empty-state.module.css';

interface EmptyStateAction {
  label: string;
  href: string;
  icon?: string;
}

interface EmptyStateProps {
  icon: string;
  heading: string;
  description: string;
  action?: EmptyStateAction;
  fill?: boolean;
}

// Shared panel for list pages (and the Logs tab) to render in place of an
// empty query result. Server component only: both async pages and the
// client LogsTab import it, so it must stay hook-free.
export default function EmptyState({ icon, heading, description, action, fill }: EmptyStateProps) {
  return (
    <div role="status" aria-live="polite" className={`${styles['empty-state']} ${fill ? styles.fill : ''}`.trim()}>
      <ion-icon name={icon} aria-hidden="true"></ion-icon>
      <h2>{heading}</h2>
      <p>{description}</p>
      {action && (
        <Link href={action.href} className={styles.action}>
          {action.icon && <ion-icon name={action.icon} aria-hidden="true"></ion-icon>}
          {action.label}
        </Link>
      )}
    </div>
  );
}
