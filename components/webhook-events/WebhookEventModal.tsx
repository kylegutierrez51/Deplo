"use client"

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Modal from '@/components/ui/modals/Modal';
import modalStyles from '@/components/ui/modals/modal.module.css';
import webhookEventStyles from './webhook-event-modal.module.css';
import Pill from '@/components/ui/Pill';
import type { PillVariant } from '@/components/ui/Pill';
import { capitalize } from '@/lib/utils/string';
import { shortSha, commitSummary, getBranch } from '@/lib/utils/git';
import RepoLink from '@/components/ui/RepoLink';
import { formatDate } from '@/lib/utils/date';
import { withParams } from '@/lib/utils/url';
import ConfirmationModal from '@/components/ui/modals/ConfirmationModal';
import { useToast } from '@/components/ui/toast/ToastContext';
import { replayWebhookEvent } from '@/lib/actions/webhook-events';

const styles = { ...modalStyles, ...webhookEventStyles };

interface WebhookEventModalProps {
  id: string;
  source?: string;
  replayBlockedReason?: string | null;
  mode?: 'view' | 'create' | 'edit';
  status?: PillVariant;
  statusReason?: string | null;
  eventType?: PillVariant;
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  pipeline?: { name: string; repoUrl: string | null } | null;
  receivedAt: Date;
  onClose: () => void;
}

export default function WebhookEventModal({
  id,
  source,
  replayBlockedReason,
  mode = 'view',
  status,
  statusReason,
  eventType,
  branch,
  commitSha,
  commitMessage,
  pipeline,
  receivedAt,
  onClose,
}: WebhookEventModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isReplaying, startReplayTransition] = useTransition();

  // ConfirmationModal types handleConfirmation as a promise, hence async despite nothing awaited here.
  const handleReplay = async () => {
    startReplayTransition(async () => {
      let result;
      try {
        result = await replayWebhookEvent(id);
      } catch {
        showToast({
          text: 'Could not replay this event. Try again.',
          icon: 'close-circle-outline',
          options: { sticky: true },
        });
        setConfirming(false);
        return;
      }

      showToast({
        text: result.message,
        icon: result.status === 'error'
          ? 'close-circle-outline'
          : result.eventStatus === 'ignored' ? 'information-circle-outline' : 'checkmark-circle-outline',
        link: result.runId ? `/runs/${result.runId}` : undefined,
        options: { sticky: true },
      });
      setConfirming(false);
      if (result.webhookEventId) {
        router.push(withParams('/webhooks/events', searchParams, { id: result.webhookEventId, mode: null }));
      }
    });
  };

  const footer =
    <>
      <button
        className={`${styles.footerBtn} ${styles.editBtn}`}
        type="button"
        disabled={!!replayBlockedReason || isReplaying}
        title={replayBlockedReason ?? undefined}
        onClick={() => setConfirming(true)}
      >Replay</button>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Close</button>
    </>

  return (
    <>
      <Modal title={"Webhook Event"} onClose={onClose} footer={footer} mode={mode}>
        <>
          <div className={styles['item-flex']}>
            {status && (
              <div className={styles.item}>
                <label>Status</label>
                <span><Pill variant={status} label={capitalize(status)} /></span>
              </div>
            )}
            {eventType && (
              <div className={styles.item}>
                <label>Event</label>
                <span><Pill variant={eventType} label={eventType === 'pull-request' ? 'Pull Request' : capitalize(eventType)} /></span>
              </div>
            )}
          </div>

          <div className={styles.item}>
            <label>Reason</label>
            <span className={styles['status-reason']} data-testid="status-reason">{statusReason ?? '—'}</span>
          </div>

          <div className={styles['item-flex']}>
            <div className={styles.item}>
              <label>Repository</label>
              <span>{pipeline?.repoUrl ? <RepoLink repoUrl={pipeline.repoUrl} /> : '—'}</span>
            </div>
            <div className={styles.item}>
              <label>Branch</label>
              <span>{branch ? getBranch(branch) : '—'}</span>
            </div>
          </div>

          <div className={styles.item}>
            <label>Commit</label>
            <div className={styles['commit-detail']}>
                {commitSha ?
                  <>
                    <span className={styles['commit-hash']} title={commitSha}>
                      <ion-icon name="git-commit-outline"></ion-icon>
                      {shortSha(commitSha)}
                    </span>
                  </>
                  : '—'
                }
              {commitMessage && <span className={styles['commit-message']} title={commitMessage}>{commitSummary(commitMessage)}</span>}
            </div>
          </div>

          <div className={styles['item-flex']}>
            <div className={styles.item}>
              <label>Pipeline</label>
              <span>{pipeline?.name ?? 'Not Found'}</span>
            </div>
            <div className={styles.item}>
              <label>Received</label>
              <span>{formatDate(receivedAt)}</span>
            </div>
          </div>

          {source && (
            <div className={styles.item}>
              <label>Source</label>
              <span>{source === 'replay' ? 'Replayed from Deplo' : 'GitHub'}</span>
            </div>
          )}
        </>
      </Modal>
      {confirming && (
        <ConfirmationModal
          message="Replay this delivery?"
          subMessage="It runs through this webhook's current settings and may start a new run for the same commit."
          action="Replay"
          variant="success"
          handleConfirmation={handleReplay}
          onClose={() => setConfirming(false)}
          timeoutMs={1500}
        />
      )}
    </>
  );
}
