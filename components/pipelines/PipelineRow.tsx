"use client"

import styles from "@/app/pipelines/pipelines.module.css";
import { capitalize } from "@/lib/utils/string";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Pipeline } from "@/lib/data/pipelines";
import Pill from '@/components/ui/Pill';


export default function PipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const { repoUrl, name, runNumber, status, commitMessage, lastRun, id } = pipeline;
  
  const router = useRouter();
  const open = () => router.push(`/pipelines?id=${id}`);

  const repoName = repoUrl ? repoUrl.slice(repoUrl.lastIndexOf('/') + 1) : null;

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{name} 
        {runNumber ? (runNumber > 0 ? 
          <><br /><span className="nowrap">Latest Run: #{runNumber}</span></> : '') 
        : ''}
      </td>
      <td><Pill variant={status} label={capitalize(status)} /></td>
      <td>{repoName || '—'}<br />{repoName && commitMessage && <span>{commitMessage}</span>}</td>
      <td className="nowrap">
        {lastRun ? (
          /* stopPropagation for the same reason as the editor link below. */
          <Link
            href={`/runs/${lastRun}`}
            className={styles['latest-run-link']}
            title="View latest run"
            target="_blank"
            aria-label={`View the latest run of ${name}`}
            onClick={e => e.stopPropagation()}
          >
            <ion-icon name="open-outline"></ion-icon>
          </Link>
        ) : 'No Runs'}
      </td>
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







