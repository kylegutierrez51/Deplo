"use client"

import styles from "@/app/pipelines/pipelines.module.css";
import { capitalize } from "@/lib/utils/string";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Pipeline } from "@/lib/data/pipelines";
import Pill from '@/components/ui/Pill';
import { formatDate } from "@/lib/utils/date";


export default function PipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const open = () => router.push(`/pipelines?id=${pipeline.id}`);

  const repoName = pipeline.repoUrl.slice(pipeline.repoUrl.lastIndexOf('/') + 1);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{pipeline.name} 
        {pipeline.runCount ? (pipeline.runCount > 0 ? 
          <><br /><span className="nowrap">{pipeline.runCount} {pipeline.runCount > 1 ? 'Runs' : 'Run'}</span></> : '') 
        : ''}
      </td>
      <td><Pill variant={pipeline.status} label={capitalize(pipeline.status)} /></td>
      <td>{repoName}<br /><span>{pipeline.commitMessage}</span></td>
      <td className="nowrap">{pipeline.lastRun ? formatDate(pipeline.lastRun) : 'No Runs'}</td>
      <td className={styles['row-action']}>
        {/* stopPropagation so the icon navigates to the editor instead of also firing the row's open() */}
        <Link
          href={`/pipelines/${pipeline.id}`}
          className={styles['editor-link']}
          title="Open in editor"
          target="_blank"
          aria-label={`Open ${pipeline.name} in the pipeline editor`}
          onClick={e => e.stopPropagation()}
        >
          <ion-icon name="open-outline"></ion-icon>
        </Link>
      </td>
    </tr>
  )
}







