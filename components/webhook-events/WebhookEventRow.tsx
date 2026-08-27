"use client"

import { useRouter } from 'next/navigation';
import Pill from '@/components/ui/Pill';
import type { WebhookEvent } from "@/lib/data/webhook-events";
import { capitalize, getRepoName, getBranch } from "@/lib/utils/string";
import { formatDate } from "@/lib/utils/date";

export default function WebhookEventRow({ event }: { event: WebhookEvent }) {
  const { status, eventType, pipeline, branch, commitSha, commitMessage, receivedAt } = event;
  
  const router = useRouter();
  const open = () => router.push(`events?id=${event.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td><Pill variant={status} label={capitalize(status)} /></td>
      <td><Pill variant={eventType} label={eventType === 'pull-request' ? 'Pull Request' : capitalize(eventType)} /></td>
      <td>{pipeline?.repoUrl ? getRepoName(pipeline.repoUrl) : '—'}</td>
      <td>{branch ? getBranch(branch) : '—' }</td>
      <td>{commitSha || '—'}<br />{<span>{commitSha && commitMessage && commitMessage}</span>}</td>
      <td>{pipeline?.name ?? 'None'}</td>
      <td>{formatDate(receivedAt)}</td>
    </tr>
  )
}