"use client"

import styles from "@/app/runs/runs.module.css";
import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { Run } from "@/lib/data/runs";
import { capitalize } from "@/lib/utils/string";

export default function RunRow({ run }: { run: Run }) {
  const router = useRouter();
  const open = () => router.push(`/runs?id=${run.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td><Pill variant={run.status} label={capitalize(run.status)} /> {run.pipeline} <br /><span>{run.repo}</span></td>
      <td><Pill variant={run.environment} label={capitalize(run.environment)} /></td>
      <td><Pill variant={run.trigger} label={run.trigger === 'api' ? 'API' : capitalize(run.trigger)} /></td>
      <td className={styles.filter}>
        <ion-icon name="stopwatch-outline"></ion-icon>
        <div className="nowrap">{run.duration}</div>
      </td>
      <td className="nowrap">{run.time}</td>
    </tr>
  )
}