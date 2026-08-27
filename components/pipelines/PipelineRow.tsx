"use client"

import styles from "@/app/pipelines/pipelines.module.css";
import { capitalize } from "@/lib/utils/string";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Pipeline } from "@/lib/data/pipelines";
import Pill from '@/components/ui/Pill';
import { formatDate } from "@/lib/utils/date";


export default function PipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const { repoUrl, name, runCount, status, commitMessage, lastRun, id } = pipeline;
  
  const router = useRouter();
  const open = () => router.push(`/pipelines?id=${id}`);

  const repoName = repoUrl ? repoUrl.slice(repoUrl.lastIndexOf('/') + 1) : null;

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{name} 
        {runCount ? (runCount > 0 ? 
          <><br /><span className="nowrap">{runCount} {runCount > 1 ? 'Runs' : 'Run'}</span></> : '') 
        : ''}
      </td>
      <td><Pill variant={status} label={capitalize(status)} /></td>
      <td>{repoName || '—'}<br />{repoName && commitMessage && <span>{commitMessage}</span>}</td>
      <td className="nowrap">{lastRun ? formatDate(lastRun) : 'No Runs'}</td>
      <td className={styles['row-action']}>
        {/* stopPropagation so the icon navigates to the editor instead of also firing the row's open() */}
        <Link
          href={`/pipelines/${id}`}
          className={styles['editor-link']}
          title="Open in editor"
          target="_blank"
          aria-label={`Open ${name} in the pipeline editor`}
          onClick={e => e.stopPropagation()}
        >
          <ion-icon name="open-outline"></ion-icon>
        </Link>
      </td>
    </tr>
  )
}







