"use client"

import styles from '@/app/audits/audit.module.css';
import { useRouter } from 'next/navigation';
import type { Audit } from "@/lib/data/audits";
import { formatDate } from '@/lib/utils/date';
import ResourceTypePill from './ResourceTypePill';

export default function AuditRow({ audit }: { audit: Audit }) {
  const router = useRouter();

  const open = () => router.push(`/audits?id=${audit.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{audit.action} <ResourceTypePill type={audit.resourceType} /></td>
      <td>{audit.resourceLabel ?? '—'}</td>
      <td>{audit.user ?? audit.actor ?? "System"}</td>
      <td className={styles.nowrap}>{formatDate(audit.createdAt)}</td>
    </tr>
  )
}


