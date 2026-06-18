"use client"

import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { WebhookEvent } from "@/lib/data/webhook-events";
import { capitalize } from "@/lib/utils/string";

export default function WebhookEventRow({ event }: { event: WebhookEvent }) {
  const router = useRouter();
  const open = () => router.push(`events?id=${event.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td><Pill variant={event.status} label={capitalize(event.status)} /></td>
      <td><Pill variant={event.eventType} label={event.eventType === 'pull-request' ? 'Pull Request' : capitalize(event.eventType)} /></td>
      <td>{event.repository}</td>
      <td>{event.branch}</td>
      <td>{event.commitHash}<br /><span>{event.commitMessage}</span></td>
      <td>{event.pipeline}</td>
      <td>{event.received}</td>
    </tr>
  )
}