"use client"

import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import type { Webhook } from '@/lib/data/webhooks';
import type { EventType } from '@/lib/types';
import Pill from '@/components/ui/Pill';
import { formatDate } from '@/lib/utils/date';
import { capitalize } from '@/lib/utils/string';
import { repoUrlWarning } from '@/lib/pipeline/repo-url';
import RepoUrlWarning from './RepoUrlWarning';
import styles from './webhook-row.module.css';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  push: 'Push',
  'pull-request': 'Pull Request',
  ping: 'Ping',
  unrecognized: 'Unrecognized',
};

export default function WebhookRow({ webhook }: { webhook: Webhook }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/webhooks', searchParams, { id: webhook.id, mode: null }));
  const warning = webhook.pipelineName ? repoUrlWarning(webhook.pipelineName, webhook.pipelineRepoUrl) : null;

  return (
    <>
      <tr className={`${styles.row}${warning ? ` ${styles['has-warning']}` : ''}`} onClick={open}>
        <td className={styles.identity}>
          <button type="button" className={`${styles.name}${!webhook.pipelineName ? ` ${styles.missing}` : ''}`} onClick={e => { e.stopPropagation(); open(); }}>
            {webhook.pipelineName || 'Pipeline Not Found'}
          </button>
        </td>
        <td className={styles.status} data-label="Status">
          <Pill variant={webhook.isActive ? 'processed' : 'ignored'} label={webhook.isActive ? 'Active' : 'Inactive'} />
        </td>
        <td className={styles.events} data-label="Events"><div className={styles.pills}>
          {webhook.events.length ? webhook.events.map(event => <Pill key={event} variant={event} label={EVENT_TYPE_LABELS[event]} />) : <span className={styles.muted}>None</span>}
        </div></td>
        <td className={styles.environment} data-label="Environment">
          {webhook.environment ? <div className={styles.pills}>
            <span className={styles['environment-name']}>{webhook.environment.name}</span>
            <Pill variant={webhook.environment.type} label={capitalize(webhook.environment.type)} />
          </div> : <span className={styles.muted}>None</span>}
        </td>
        <td className={styles.delivery} data-label="Last delivery">
          {webhook.lastDelivery ? <time dateTime={webhook.lastDelivery.toISOString()}>{formatDate(webhook.lastDelivery)}</time> : <span className={styles.muted}>No deliveries yet</span>}
        </td>
      </tr>
      {warning && <tr className={styles['warning-row']} onClick={open}><td colSpan={5}><RepoUrlWarning message={warning} /></td></tr>}
    </>
  );
}
