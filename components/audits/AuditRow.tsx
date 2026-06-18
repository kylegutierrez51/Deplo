"use client"

import styles from '@/app/audits/audit.module.css';
import { useRouter } from 'next/navigation';
import type { Audit } from "@/lib/data/audits";

export default function AuditRow({ audit }: { audit: Audit }) {
  const router = useRouter();

  const open = () => router.push(`/audits?id=${audit.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{audit.action}</td>
      <td>push → acme/api-server <span className={styles['audit-category']}>[{audit.category}]</span></td>
      <td>{audit.actor}</td>
      <td className={styles.nowrap}>{audit.time}</td>
    </tr>
  )
}


