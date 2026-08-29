"use client"

import styles from "@/app/runs/runs.module.css";
import { useRouter } from 'next/navigation';
import Pill from '@/components/ui/Pill';
import type { Run } from "@/lib/data/runs";
import { capitalize } from "@/lib/utils/string";
import { formatDate, getDuration } from "@/lib/utils/date";

export default function RunRow({ run }: { run: Run }) {
  const { status, pipelineName, runNumber, repoUrl, environment, trigger, startedAt, finishedAt, createdAt } = run;


  const router = useRouter();
  const open = () => router.push(`/runs?id=${run.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>
        <div className={styles['pipeline-detail']}>
          <div className={styles['status-name']}>
            <Pill variant={status} label={capitalize(status)} /> 
            {pipelineName}
          </div>
          <span>#{runNumber}</span>
        </div>
        {repoUrl && <span>{repoUrl}</span>}
      </td>
      <td>
        {environment ? 
          <>
            {environment.name} <Pill variant={environment.type} label={capitalize(environment.type)} /> 
          </> : "None" }
      </td>
      <td><Pill variant={trigger} label={trigger === 'api' ? 'API' : capitalize(trigger)} /></td>
      <td className={styles.filter}>
        <ion-icon name="stopwatch-outline"></ion-icon>
        <div className="nowrap">{startedAt && finishedAt ? getDuration(startedAt, finishedAt) : startedAt ? 'Ongoing' : '—'}</div>
      </td>
      <td className="nowrap">{formatDate(createdAt)}</td>
    </tr>
  )
}