"use client"

import styles from '@/app/environments/env.module.css';
import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { Environment } from "@/lib/data/environments";
import { capitalize } from "@/lib/utils/string";

export default function EnvironmentRow({ env }: { env: Environment }) {
  const router = useRouter();

  const open = () => router.push(`/environments?id=${env.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td className={styles.filter}>
        <div>{env.name}</div>
      </td>
      <td><Pill variant={env.type} label={capitalize(env.type)} /></td>
      <td className={styles.filter}><ion-icon name="key-outline"></ion-icon><div>{env.secrets || 0}</div></td>
      <td>{env.pipelines || 0}</td>
      <td>{env.updatedAt}</td>
    </tr>
  )
}


