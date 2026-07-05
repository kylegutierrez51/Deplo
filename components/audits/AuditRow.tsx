"use client"

import styles from '@/app/audits/audit.module.css';
import { useRouter } from 'next/navigation';
import type { Audit } from "@/lib/data/audits";
import { formatDate } from '@/lib/utils/string';

export default function AuditRow({ audit }: { audit: Audit }) {
  const router = useRouter();

  const open = () => router.push(`/audits?id=${audit.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{audit.action}</td>
      <td>{audit.resourceLabel ?? '—'} <span className={styles['audit-category']}>[{audit.resourceType}]</span></td>
      <td>{audit.user ?? audit.actor ?? "System"}</td>
      <td className={styles.nowrap}>{formatDate(audit.createdAt)}</td>
    </tr>
  )
}


