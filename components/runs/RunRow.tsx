"use client"

import styles from './run-row.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { Run } from '@/lib/data/runs';
import { capitalize } from '@/lib/utils/string';
import { formatDate, getDuration } from '@/lib/utils/date';
import EnvironmentLabel from './EnvironmentLabel';
import RepoLink from '@/components/ui/RepoLink';

export default function RunRow({ run }: { run: Run }) {
  const { status, pipelineName, runNumber, repoUrl, environment, trigger, startedAt, finishedAt, createdAt } = run;
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/runs', searchParams, { id: run.id, mode: null }));

  return (
    <tr className={styles.row} onClick={open}>
      <td className={styles.identity}>
        <div className={styles['pipeline-heading']}>
          <button type="button" className={styles.name} onClick={e => { e.stopPropagation(); open(); }}>
            {pipelineName ?? 'Deleted pipeline'}
          </button>
          <span className={styles['run-number']}>#{runNumber}</span>
        </div>
        <div className={styles.meta}>
          <Pill variant={status} label={capitalize(status)} />
          {repoUrl && <RepoLink repoUrl={repoUrl} />}
        </div>
      </td>
      <td className={styles.environment}>
        <span className={styles['field-label']}>Environment</span>
        {environment ? <EnvironmentLabel environment={environment} /> : <span className={styles.muted}>None</span>}
      </td>
      <td className={styles.trigger}>
        <span className={styles['field-label']}>Trigger</span>
        <Pill variant={trigger} label={trigger === 'api' ? 'API' : capitalize(trigger)} />
      </td>
      <td className={styles.duration}>
        <span className={styles['field-label']}>Duration</span>
        <span className={styles['duration-value']}>
          <ion-icon name="stopwatch-outline" aria-hidden="true"></ion-icon>
          {startedAt && finishedAt ? getDuration(startedAt, finishedAt) : startedAt ? 'Ongoing' : '—'}
        </span>
      </td>
      <td className={styles.created}>
        <span className={styles['field-label']}>Created at</span>
        <time dateTime={createdAt.toISOString()}>{formatDate(createdAt)}</time>
      </td>
    </tr>
  );
}
