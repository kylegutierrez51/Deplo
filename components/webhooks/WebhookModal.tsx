"use client"

import { useState, useRef, useActionState } from 'react';
import { formatDate } from '@/lib/utils/date';
import type { FormState, EventType } from '@/lib/types';
import type { Pipeline } from '@/lib/data/pipelines';
import type { Environment } from '@/lib/data/environments';
import Modal from '@/components/ui/modals/Modal';
import ConfirmationModal from '@/components/ui/modals/ConfirmationModal';
import modalStyles from '@/components/ui/modals/modal.module.css';
import webhookStyles from './webhook-modal.module.css';
import Autocomplete from '@/components/ui/Autocomplete';
import { addWebhook, updateWebhook, deleteWebhook, regenerateWebhookSecret } from '@/lib/actions/webhooks';
import Pill from '../ui/Pill';
import { capitalize } from '@/lib/utils/string';

const styles = { ...modalStyles, ...webhookStyles };

interface WebhookModalProps {
  mode?: 'view' | 'edit' | 'create';
  id: string;
  pipelineId?: string | null;
  pipelineName?: string | null;
  environmentId?: string | null;
  environmentName?: string | null;
  branchFilters: string[];
  events: EventType[];
  createdBy?: string | null;
  lastDelivery?: Date | null;
  createdAt: Date;
  pipelines: Pipeline[] | null;
  environments: Environment[] | null;
  onClose: () => void;
  onCreate: (message: string) => void;
  onDelete: (message: string) => void;
  onEdit: () => void;
  onEditOrDeleteClose: () => void;
  onSave: (message: string) => void;
  onRegenerate: (message: string) => void;
  onError: (message: string) => void;
}

const initialState: FormState = {
  status: 'idle',
  message: '',
}

const EVENT_DEFS: { key: EventType, label: string, desc: string }[] = [
  { key: 'push', label: 'Push', desc: 'Triggered when commits are pushed to a branch' },
  { key: 'pull-request', label: 'Pull Request', desc: 'Triggered on PR open, sync, or merge' },
];

export default function WebhookModal({
  mode = 'view',
  id,
  pipelineId,
  pipelineName,
  environmentId,
  environmentName,
  branchFilters = [],
  events = [],
  createdBy,
  lastDelivery,
  createdAt,
  pipelines,
  environments,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onEditOrDeleteClose,
  onSave,
  onRegenerate,
  onError,
}: WebhookModalProps) {
  const [filters, setBranchFilters] = useState<string[]>(branchFilters);
  const [enteredBranchFilter, setEnteredBranchFilter] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<EventType[]>(events);
  const [secret, setSecret] = useState('');
  const branchInputRef = useRef<HTMLInputElement>(null);

  const [deleteModal, setDeleteModal] = useState(false);
  const [regenerateModal, setRegenerateModal] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedSecretVisible, setRevealedSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const [, createFormAction, createPending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addWebhook(prev, formData);
    if (result.status === 'success') onCreate(result.message);
    else if (result.status === 'error') onError(result.message);
    return result;
  }, initialState);
  const [, editFormAction, editPending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateWebhook(prev, formData);
    if (result.status === 'success') onSave(result.message);
    else if (result.status === 'error') onError(result.message);
    return result;
  }, initialState);
  const pending = createPending || editPending;


  const handleDeleteClose = () => {
    setDeleteModal(false);
    onEditOrDeleteClose();
  }


  const deleteRecord = async () => {
    const deletedRecord = await deleteWebhook(id);
    if (deletedRecord.status === 'success') {
      onDelete(deletedRecord.message);
    }
    else if (deletedRecord.status === 'error') {
      onError(deletedRecord.message);
    }
    setDeleteModal(false);
  }

  
  const afterRegenerate=(newSecret: string) => {
    setRevealedSecret(newSecret);
    setRevealedSecretVisible(false);
  }


  const handleRegenerate = async () => {
    const result = await regenerateWebhookSecret(id);
    if (result.status === 'success' && result.secret) {
      afterRegenerate(result.secret);
      onRegenerate(result.message);
    }
    else if (result.status === 'error') {
      onError(result.message);
    }
    setRegenerateModal(false);
  }


  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = branchInputRef.current?.value.trim();
    if (!value) return;
    setBranchFilters(prev => [...prev, value]);
    setEnteredBranchFilter('');
    if (branchInputRef.current) branchInputRef.current.value = '';
  };


  const removeBranchFilter = (index: number) => {
    setBranchFilters(prev => prev.filter((_, i) => i !== index));
  };


  const toggleEvent = (key: EventType) => {
    setSelectedEvents(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]);
  };


  const handleGenerateSecret = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    setSecret(`whsec_${hex}`);
  };


  const handleCopyRevealed = () => {
    if (!revealedSecret) return;
    navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };


  if (mode === 'view' && revealedSecret !== null) setRevealedSecret(null);

  const title = mode === 'view' ? 'Webhook' : (mode === 'create' ? 'Add Webhook' : 'Edit Webhook');
  const subtitle = mode === 'edit' || mode === 'create' ? 'Register a GitHub webhook to trigger a pipeline automatically.' : undefined;
  const icon = mode === 'edit' || mode === 'create' ? 'git-network-outline' : undefined;

  const footer = mode === 'view' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.deleteBtn}`} type="button" onClick={() => setDeleteModal(true)}>Delete</button>
      <button className={`${styles.footerBtn} ${styles.editBtn}`} type="button" onClick={onEdit}>Edit</button>
    </>
  ) : (mode === 'create' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose} disabled={pending}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="submit" form="modal-form" disabled={pending}>{pending ? 'Creating…' : 'Create'}</button>
    </>
  ) :
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onEditOrDeleteClose} disabled={pending}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="submit" form="modal-form" disabled={pending}>{pending ? 'Saving…' : 'Save Changes'}</button>
    </>
  );

  return (
    <>
      <Modal action={mode === 'create' ? createFormAction : editFormAction} pending={pending} title={title} subtitle={subtitle} icon={icon} onClose={onClose} footer={footer} mode={mode}>
        {mode === 'view' ? (
          <>
            <div className={styles.fieldGroup}>
              <label>Pipeline to trigger</label>
              <div className={styles.selectWrapper}>
                <ion-icon name="link-outline" className={styles.selectIconLeft}></ion-icon>
                <span>{pipelineName}</span>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label>Environment</label>
              {environmentName ? (
                <div className={styles.selectWrapper}>
                  <ion-icon name="layers-outline" className={styles.selectIconLeft}></ion-icon>
                  <span>{environmentName}</span>
                </div>
              ) : (
                <span className={styles.emptyValue}>None — runs do not use secrets</span>
              )}
            </div>

            {filters.length > 0 && (
              <div className={styles.fieldGroup}>
                <label>Branch filters</label>
                <div className={styles.branchPills}>
                  {filters.map((p, i) => <span key={i} className={styles.branchPill}>{p}</span>)}
                </div>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label>Trigger events</label>
              {selectedEvents.length > 0 ? (
                <div className={styles.branchPills}>
                  {EVENT_DEFS.filter(e => selectedEvents.includes(e.key))
                    .map(e => <Pill key={e.key} variant={e.key} label={e.label} />)}
                </div>
              ) : (
                <span className={styles.emptyValue}>None — this webhook won&apos;t trigger</span>
              )}
            </div>

            <div className={styles['item-flex']}>
              <div className={styles.fieldGroup}>
                <label>Created By</label>
                <span>{createdBy || 'Unknown User'}</span>
              </div>
              <div className={styles.fieldGroup}>
                <label>Last Delivery</label>
                <span>{lastDelivery ? formatDate(lastDelivery) : '—'}</span>
              </div>
              <div className={styles.fieldGroup}>
                <label>Created At</label>
                <span>{formatDate(createdAt)}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="id" value={id ?? ''} />

            <div className={styles.fieldGroup}>
              <label htmlFor="pipeline-name">Pipeline to trigger</label>
              <Autocomplete
                id="pipeline-name"
                idName="pipeline_id"
                textName="pipeline_name"
                placeholder="e.g. deploy-api"
                emptyText="No matching pipelines"
                options={pipelines?.map(p => ({ id: p.id, name: p.name, detail: p.repoUrl })) ?? []}
                initialId={pipelineId}
                initialName={pipelineName}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="environment-name">
                Environment
                <span className={styles.optionalBadge}>optional</span>
              </label>
              <Autocomplete
                id="environment-name"
                idName="environment_id"
                textName="environment_name"
                placeholder="e.g. production"
                emptyText="No matching environments"
                options={environments?.map(e => ({ id: e.id, name: e.name, detail: capitalize(e.type) })) ?? []}
                initialId={environmentId}
                initialName={environmentName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label>
                Branch filters
                <span className={styles.optionalBadge}>optional</span>
              </label>
              <input
                type="text"
                ref={branchInputRef}
                placeholder="e.g. main, release/*, feature/* — press Enter to add"
                onKeyDown={handleBranchKeyDown}
                value={enteredBranchFilter}
                onChange={(e) => setEnteredBranchFilter(e.target.value)}
              />
              <p className={styles.fieldHint}>
                <ion-icon name="information-circle-outline"></ion-icon>
                Glob pattern. Leave empty to trigger on all branches.
              </p>
              
              <div className={styles.branchPills}>
                {filters.map((p, i) => (
                  <span key={i} className={styles.branchPill}>
                    {p}
                    <button
                      type="button"
                      className={styles.branchPillRemove}
                      onClick={() => removeBranchFilter(i)}
                      aria-label={`Remove branch filter ${p}`}
                    >
                      <ion-icon name="close-outline"></ion-icon>
                    </button>
                    <input type="hidden" name="branch_filters" value={p} />
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label>Trigger events</label>
              <div className={styles.eventCards}>
                {EVENT_DEFS.map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className={`${styles.eventCard} ${selectedEvents.includes(key) ? styles.eventCardChecked : ''}`}
                  >
                    <div className={styles.eventCardCheckbox}>
                      <input type="checkbox" checked={selectedEvents.includes(key)} onChange={() => toggleEvent(key)} />
                      <span className={`${styles.customCheckbox} ${selectedEvents.includes(key) ? styles.customCheckboxChecked : ''}`}></span>
                    </div>
                    <div className={styles.eventCardContent}>
                      <span className={styles.eventName}>{label}</span>
                      <span className={styles.eventDesc}>{desc}</span>
                    </div>
                  </label>
                ))}
                {selectedEvents.map((key, i) => <input key={i} type="hidden" name="events" value={key} />)}
              </div>
            </div>

            {mode === 'create' ? (
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabelRow}>
                  <label htmlFor="webhook-secret">Webhook secret</label>
                  <button type="button" className={styles.regenerateBtn} onClick={handleGenerateSecret} title="Generate secret">
                    <ion-icon name="refresh-outline"></ion-icon>
                  </button>
                </div>
                <div className={styles.secretInputWrapper}>
                  <ion-icon name="key-outline" className={styles.inputIconLeft}></ion-icon>
                  <input
                    type="text"
                    id="webhook-secret"
                    name="webhook_secret"
                    value={secret}
                    onChange={e => setSecret(e.target.value)}
                    className={styles.secretInput}
                    required
                  />
                </div>
                <p className={styles.fieldHint}>
                  <ion-icon name="information-circle-outline"></ion-icon>
                  Used for HMAC-SHA256 signature validation. Store securely — it won&apos;t be shown again.
                </p>
              </div>
            ) : (
              <div className={styles.fieldGroup}>
                <label>Webhook secret</label>
                <p className={styles.fieldHint}>
                  <ion-icon name="information-circle-outline"></ion-icon>
                  The signing secret can&apos;t be viewed again after creation. Regenerate it if it may have been compromised.
                </p>
                <button type="button" className={styles.regenerateSecretBtn} onClick={() => setRegenerateModal(true)}>
                  <ion-icon name="refresh-outline"></ion-icon>
                  Regenerate secret
                </button>

                {revealedSecret && (
                  <div className={styles.revealedSecretBanner}>
                    <div className={styles.secretInputWrapper}>
                      <ion-icon name="key-outline" className={styles.inputIconLeft}></ion-icon>
                      <input
                        type={revealedSecretVisible ? 'text' : 'password'}
                        value={revealedSecret}
                        readOnly
                        className={`${styles.secretInput} ${styles.padded}`}
                      />
                      <div className={styles.secretActions}>
                        <button type="button" className={styles.iconActionBtn} onClick={() => setRevealedSecretVisible(v => !v)}>
                          <ion-icon name={revealedSecretVisible ? 'eye-off-outline' : 'eye-outline'}></ion-icon>
                        </button>
                        <span className={styles.secretDivider}></span>
                        <button type="button" className={styles.iconActionBtn} onClick={handleCopyRevealed}>
                          <ion-icon name={copied ? 'checkmark-outline' : 'copy-outline'}></ion-icon>
                        </button>
                      </div>
                    </div>
                    <span className={styles.revealedSecretHint}>Copy this now — it won&apos;t be shown again.</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>

      {deleteModal && !regenerateModal &&
        <ConfirmationModal message={'Delete this Webhook?'} action={"Delete"} handleConfirmation={deleteRecord} onClose={handleDeleteClose} timeoutMs={2000} />
      }

      {regenerateModal && !deleteModal &&
        <ConfirmationModal 
          message={"Regenerate this webhook's secret? The current secret will stop validating deliveries immediately"} 
          action={"Regenerate"} 
          handleConfirmation={handleRegenerate} 
          onClose={() => setRegenerateModal(false)} 
          timeoutMs={2000} />
      }
    </>
  );
}
