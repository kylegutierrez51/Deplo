"use client"

import styles from './pipeline-row.module.css';
import { capitalize } from '@/lib/utils/string';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import { repoName } from '@/lib/utils/git';
import type { Pipeline } from '@/lib/data/pipelines';
import Pill from '@/components/ui/Pill';

export default function PipelineRow({ pipeline }: { pipeline: Pipeline }) {
  const { repoUrl, name, runNumber, status, lastRun, id } = pipeline;
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/pipelines', searchParams, { id, mode: null }));
  const repo = repoUrl ? repoName(repoUrl) : null;

  return (
    <tr className={styles.row} onClick={open}>
      <td>
        <div className={styles.details}>
          <button type="button" className={styles.name} onClick={e => { e.stopPropagation(); open(); }}>{name}</button>
          <span className={styles.repository} title={repoUrl ?? undefined}>
            {repo ? <><ion-icon name="logo-github" aria-hidden="true"></ion-icon>{repo}</> : 'No repository'}
          </span>
        </div>
      </td>
      <td className={styles.status}><Pill variant={status} label={capitalize(status)} /></td>
      <td className={styles['latest-run']}>
        {lastRun ? (
          <Link
            href={`/runs/${lastRun}`}
            className={styles['run-link']}
            title="View latest run"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View the latest run of ${name}`}
            onClick={e => e.stopPropagation()}
          >
            {runNumber ? `Run #${runNumber}` : 'View run'}
            <ion-icon name="open-outline" aria-hidden="true"></ion-icon>
          </Link>
        ) : <span className={styles['no-runs']}>No runs yet</span>}
      </td>
      <td className={styles.actions}>
        <Link
          href={`/pipelines/${id}`}
          className={styles['editor-link']}
          title="Open in editor"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} in the pipeline editor`}
          onClick={e => e.stopPropagation()}
        >
          Edit stages <ion-icon name="open-outline" aria-hidden="true"></ion-icon>
        </Link>
      </td>
    </tr>
  );
}
