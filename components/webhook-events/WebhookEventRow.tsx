"use client"

import { useRouter } from 'next/navigation';
import Pill from '@/components/ui/Pill';
import type { WebhookEvent } from "@/lib/data/webhook-events";
import { capitalize, getRepoName, getBranch } from "@/lib/utils/string";
import { formatDate } from "@/lib/utils/date";

export default function WebhookEventRow({ event }: { event: WebhookEvent }) {
  const router = useRouter();
  const open = () => router.push(`events?id=${event.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td><Pill variant={event.status} label={capitalize(event.status)} /></td>
      <td><Pill variant={event.eventType} label={event.eventType === 'pull-request' ? 'Pull Request' : capitalize(event.eventType)} /></td>
      <td>{event.pipeline ? getRepoName(event.pipeline?.repoUrl) : 'None'}</td>
      <td>{event.branch ? getBranch(event.branch) : 'None' }</td>
      <td>{event.commitSha}<br /><span>{event.commitMessage}</span></td>
      <td>{event.pipeline?.name ?? 'None'}</td>
      <td>{formatDate(event.receivedAt)}</td>
    </tr>
  )
}