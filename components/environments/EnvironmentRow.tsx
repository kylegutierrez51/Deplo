"use client"

import styles from '@/components/ui/resource-list.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { Environment } from '@/lib/data/environments';
import { capitalize } from '@/lib/utils/string';
import { formatDate } from '@/lib/utils/date';

export default function EnvironmentRow({ env }: { env: Environment }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/environments', searchParams, { id: env.id, mode: null }));

  return (
    <tr className={styles.row} onClick={open}>
      <td className={styles.identity}>
        <button type="button" className={styles.name} onClick={e => { e.stopPropagation(); open(); }}>{env.name}</button>
      </td>
      <td className={styles.type}>
        <span className={styles['field-label']}>Environment type</span>
        <Pill variant={env.type} label={capitalize(env.type)} />
      </td>
      <td className={styles.secrets}>
        <span className={styles['field-label']}>Secrets</span>
        <span className={styles['secret-count']}><ion-icon name="key-outline" aria-hidden="true"></ion-icon>{env.secrets || 0}</span>
      </td>
      <td className={styles.updated}>
        <span className={styles['field-label']}>Last updated</span>
        <time dateTime={env.updatedAt.toISOString()}>{formatDate(env.updatedAt)}</time>
      </td>
    </tr>
  );
}
