"use client"

import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { WebhookEvent } from '@/lib/data/webhook-events';
import { capitalize } from '@/lib/utils/string';
import { shortSha, commitSummary, getBranch } from '@/lib/utils/git';
import RepoLink from '@/components/ui/RepoLink';
import { formatDate } from '@/lib/utils/date';
import styles from './webhook-event-row.module.css';

export default function WebhookEventRow({ event }: { event: WebhookEvent }) {
  const { status, statusReason, eventType, source, pipeline, branch, commitSha, commitMessage, receivedAt } = event;
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/webhooks/events', searchParams, { id: event.id, mode: null }));

  return (
    <tr className={styles.row} onClick={open}>
      <td className={styles['status-cell']}>
        <div className={styles.status}>
          <button type="button" className={styles['status-button']} aria-label="View delivery details" onClick={e => { e.stopPropagation(); open(); }}>
            <Pill variant={status} label={capitalize(status)} />
          </button>
          {statusReason && <span className={styles.reason} title={statusReason}>{statusReason}</span>}
        </div>
      </td>
      <td data-label="Event">
        <div className={styles.status}>
          <Pill variant={eventType} label={eventType === 'pull-request' ? 'Pull Request' : capitalize(eventType)} />
          {/* A replay copies the original payload; this marker distinguishes it. */}
          {source === 'replay' && (
            <span className={styles.replay} title="Replayed from Deplo">
              <ion-icon name="refresh-outline" aria-hidden="true"></ion-icon>Replay
            </span>
          )}
        </div>
      </td>
      <td data-label="Repository">{pipeline?.repoUrl ? <RepoLink repoUrl={pipeline.repoUrl} short /> : '—'}</td>
      <td className={styles.branch} data-label="Branch">{branch ? getBranch(branch) : '—'}</td>
      <td className={styles['commit-cell']} data-label="Commit">
        {commitSha ? <span className={styles.sha} title={commitSha}>{shortSha(commitSha)}</span> : '—'}
        {commitSha && commitMessage && <span className={styles['commit-message']} title={commitMessage}>{commitSummary(commitMessage)}</span>}
      </td>
      <td data-label="Pipeline">{pipeline?.name ?? 'None'}</td>
      <td className={styles['received-cell']} data-label="Received">
        <time dateTime={receivedAt.toISOString()}>{formatDate(receivedAt)}</time>
      </td>
    </tr>
  );
}
