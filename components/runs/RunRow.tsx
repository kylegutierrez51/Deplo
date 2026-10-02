"use client"

import styles from "@/app/runs/runs.module.css";
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { Run } from "@/lib/data/runs";
import { capitalize } from "@/lib/utils/string";
import { formatDate, getDuration } from "@/lib/utils/date";
import RunLabel from './RunLabel';
import EnvironmentLabel from './EnvironmentLabel';

export default function RunRow({ run }: { run: Run }) {
  const { status, pipelineName, runNumber, repoUrl, environment, trigger, startedAt, finishedAt, createdAt } = run;


  const router = useRouter();


  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/runs', searchParams, { id: run.id, mode: null })); 

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>
        <RunLabel pipelineName={pipelineName} runNumber={runNumber} status={status} />
        {repoUrl && <span>{repoUrl}</span>}
      </td>
      <td>
        {environment ? <EnvironmentLabel environment={environment} /> : "None"}
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