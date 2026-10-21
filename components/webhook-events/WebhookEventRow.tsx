"use client"

import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { WebhookEvent } from "@/lib/data/webhook-events";
import { capitalize, getRepoName, getBranch } from "@/lib/utils/string";
import { formatDate } from "@/lib/utils/date";
import styles from "./webhook-event-row.module.css";

export default function WebhookEventRow({ event }: { event: WebhookEvent }) {
  const { status, statusReason, eventType, source, pipeline, branch, commitSha, commitMessage, receivedAt } = event;
  
  const router = useRouter();
  
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/webhooks/events', searchParams, { id: event.id, mode: null })); 

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>
        <div className={styles.status}>
          <Pill variant={status} label={capitalize(status)} />
          {statusReason && <span className={styles.reason} title={statusReason}>{statusReason}</span>}
        </div>
      </td>
      <td>
        <div className={styles.status}>
          <Pill variant={eventType} label={eventType === 'pull-request' ? 'Pull Request' : capitalize(eventType)} />
          {/* A replay copies the original's payload, so this is what tells the two rows apart */}
          {source === 'replay' && (
            <span className={styles.replay} title="Replayed from Deplo">
              <ion-icon name="refresh-outline"></ion-icon>
              Replay
            </span>
          )}
        </div>
      </td>
      <td>{pipeline?.repoUrl ? getRepoName(pipeline.repoUrl) : '—'}</td>
      <td>{branch ? getBranch(branch) : '—' }</td>
      <td>{commitSha || '—'}<br />{<span>{commitSha && commitMessage && commitMessage}</span>}</td>
      <td>{pipeline?.name ?? 'None'}</td>
      <td>{formatDate(receivedAt)}</td>
    </tr>
  )
}