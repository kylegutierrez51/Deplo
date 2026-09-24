"use client"

import styles from '@/app/audits/audit.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Link from 'next/link';
import type { Audit } from "@/lib/data/audits";
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
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{action} <ResourceTypePill type={resourceType} /></td>
      <td><AuditResourceLabel resourceLabel={resourceLabel} resourceMeta={resourceMeta} /></td>
      <td>{user ?? actor ?? "System"}</td>
      <td className={styles.nowrap}>{formatDate(createdAt)}</td>
      <td className={styles['row-action']}>
        <Link
          href={resourceHref(resourceType, resourceId)}
          className={styles['editor-link']}
          title="Open resource"
          target="_blank"
          aria-label={`Open resource`}
          onClick={e => e.stopPropagation()}
        >
          <ion-icon name="open-outline"></ion-icon>
        </Link>
      </td>
    </tr>
  )
}


