"use client"

import styles from '@/components/ui/resource-list.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { Secret } from '@/lib/data/secrets';
import { capitalize, truncateText } from '@/lib/utils/string';
import { formatDate } from '@/lib/utils/date';

export default function SecretRow({ secret }: { secret: Secret }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/secrets', searchParams, { id: secret.id, mode: null }));

  return (
    <tr className={styles.row} onClick={open}>
      <td className={styles.identity}>
        <button type="button" className={`${styles.name} ${styles['secret-key']}`} onClick={e => { e.stopPropagation(); open(); }}>
          {secret.key}
        </button>
        {secret.notes && <span className={styles.notes} title={secret.notes}>{secret.notes.length > 40 ? secret.notes.slice(0, 40) + '...' : secret.notes}</span>}
      </td>
      <td className={styles.environment}>
        <span className={styles['field-label']}>Environment</span>
        {secret.environment ? (
          <span className={styles['environment-value']}>
            <span>{truncateText(secret.environment.name)}</span>
            <Pill variant={secret.environment.type} label={capitalize(secret.environment.type)} />
          </span>
        ) : <span className={styles.muted}>None</span>}
      </td>
      <td className={styles.updated}>
        <span className={styles['field-label']}>Last updated</span>
        <time dateTime={secret.updatedAt.toISOString()}>{formatDate(secret.updatedAt)}</time>
      </td>
    </tr>
  );
}
