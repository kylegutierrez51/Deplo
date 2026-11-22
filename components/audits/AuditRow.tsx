"use client"

import styles from './audit-row.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Link from 'next/link';
import type { Audit } from '@/lib/data/audits';
import { formatDate } from '@/lib/utils/date';
import ResourceTypePill from './ResourceTypePill';
import AuditResourceLabel from './AuditResourceLabel';
import { resourceHref } from './resourcePath';

export default function AuditRow({ audit }: { audit: Audit }) {
  const { action, resourceType, resourceLabel, resourceMeta, resourceId, user, actor, createdAt } = audit;
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/audits', searchParams, { id: audit.id, mode: null }));

  return (
    <tr className={styles.row} onClick={open}>
      <td className={styles.action}>
        <button type="button" className={styles.name}>{action}</button>
        <div className={styles['resource-type']}><ResourceTypePill type={resourceType} /></div>
      </td>
      <td className={styles.resource}>
        <span className={styles['field-label']}>Resource</span>
        <AuditResourceLabel resourceLabel={resourceLabel} resourceMeta={resourceMeta} />
      </td>
      <td className={styles.actor}>
        <span className={styles['field-label']}>Actor</span>
        {user ?? actor ?? 'System'}
      </td>
      <td className={styles.time}>
        <span className={styles['field-label']}>Time</span>
        <time dateTime={createdAt.toISOString()}>{formatDate(createdAt)}</time>
      </td>
      <td className={styles['row-action']}>
        <Link href={resourceHref(resourceType, resourceId)} className={styles['resource-link']} title="Open resource" target="_blank" rel="noopener noreferrer" aria-label="Open resource" onClick={e => e.stopPropagation()}>
          Open resource <ion-icon name="open-outline" aria-hidden="true"></ion-icon>
        </Link>
      </td>
    </tr>
  );
}
