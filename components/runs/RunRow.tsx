"use client"

import styles from "@/app/runs/runs.module.css";
import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { Run } from "@/lib/data/runs";
import { capitalize } from "@/lib/utils/string";
import { formatDate, getTimeDifference } from "@/lib/utils/date";

export default function RunRow({ run }: { run: Run }) {
  const router = useRouter();
  const open = () => router.push(`/runs?id=${run.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td><Pill variant={run.status} label={capitalize(run.status)} /> {run.pipelineName} <br /><span>{run.repoUrl}</span></td>
      <td>
        {run.environment ? 
          <>
            {run.environment.name} <Pill variant={run.environment.type} label={capitalize(run.environment.type)} /> 
          </> : "None" }
      </td>
      <td><Pill variant={run.trigger} label={run.trigger === 'api' ? 'API' : capitalize(run.trigger)} /></td>
      <td className={styles.filter}>
        <ion-icon name="stopwatch-outline"></ion-icon>
        <div className="nowrap">{run.startedAt && run.finishedAt ? getTimeDifference(run.startedAt, run.finishedAt) : run.startedAt ? 'Ongoing' : '—'}</div>
      </td>
      <td className="nowrap">{formatDate(run.createdAt)}</td>
    </tr>
  )
}