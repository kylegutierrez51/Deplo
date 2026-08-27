"use client"

import { useState, useRef, useEffect, useActionState } from 'react';
import { formatDate } from '@/lib/utils/date';
import type { FormState } from '@/lib/types';
import type { Pipeline } from '@/lib/data/pipelines';
import Modal from '@/components/ui/modals/Modal';
import ConfirmationModal from '@/components/ui/modals/ConfirmationModal';
import modalStyles from '@/components/ui/modals/modal.module.css';
import webhookStyles from './webhook-modal.module.css';
import { addWebhook, updateWebhook, deleteWebhook, regenerateWebhookSecret } from '@/lib/actions/webhooks';

const styles = { ...modalStyles, ...webhookStyles };

interface WebhookModalProps {
  mode?: 'view' | 'edit' | 'create';
  id: string;
  pipelineName?: string | null;
  branchFilters: string[];
  events: string[];
  createdBy?: string | null;
  lastDelivery?: Date | null;
  createdAt: Date;
  pipelines: Pipeline[] | null;
  onClose: () => void;
  onCreate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditOrDeleteClose: () => void;
  onSave: () => void;
  onError: (message: string) => void;
}

const initialState: FormState = {
  status: 'idle',
  message: '',
}

const EVENT_DEFS = [
  { key: 'push', label: 'Push', desc: 'Triggered when commits are pushed to a branch' },
  { key: 'pull_request', label: 'Pull Request', desc: 'Triggered on PR open, sync, or merge' },
];

export default function WebhookModal({
  mode = 'view',
  id,
  pipelineName,
  branchFilters = [],
  events = [],
  createdBy,
  lastDelivery,
  createdAt,
  pipelines,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onEditOrDeleteClose,
  onSave,
  onError,
}: WebhookModalProps) {
  const [filters, setBranchFilters] = useState<string[]>(branchFilters);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(events);
  const [secret, setSecret] = useState('');
  const branchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(pipelineName ?? '');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    pipelines?.find(p => p.name === pipelineName)?.id ?? null
  );
  const [openMatches, setOpenMatches] = useState(false);

  const [deleteModal, setDeleteModal] = useState(false);
  const [regenerateModal, setRegenerateModal] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedSecretVisible, setRevealedSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const [createState, createFormAction] = useActionState(addWebhook, initialState);
  const [editState, editFormAction] = useActionState(updateWebhook, initialState);

  useEffect(() => {
    if (createState.status === 'success') {
      onCreate();
    }
    else if (createState.status === 'error') {
      onError(createState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createState]);

  useEffect(() => {
    if (editState.status === 'success') {
      onSave();
    }
    else if (editState.status === 'error') {
      onError(editState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- don't add onSave as a dep so that this effect doesn't rerun when CrudModalController re-renders via showToast() and hands down a new function reference
  }, [editState]);

  const handleDeleteClose = () => {
    setDeleteModal(false);
    onEditOrDeleteClose();
  }

  const deleteRecord = async () => {
    const deletedRecord = await deleteWebhook(id);
    if (deletedRecord.status === 'success') {
      onDelete();
    }
    else if (deletedRecord.status === 'error') {
      onError(deletedRecord.message);
    }
  }

  const onRegenerate=(newSecret: string) => {
    setRevealedSecret(newSecret);
    setRevealedSecretVisible(false);
    setRegenerateModal(false);
  }


  const handleRegenerate = async () => {
    const result = await regenerateWebhookSecret(id);
    if (result.status === 'success' && result.secret) {
      onRegenerate(result.secret);
    }
    else if (result.status === 'error') {
      onError(result.message);
    }
  }

  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = branchInputRef.current?.value.trim();
    if (!value) return;
    setBranchFilters(prev => [...prev, value]);
    if (branchInputRef.current) branchInputRef.current.value = '';
  };

  const removeBranchFilter = (index: number) => {
    setBranchFilters(prev => prev.filter((_, i) => i !== index));
  };

  const toggleEvent = (key: string) => {
    setSelectedEvents(prev => prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]);
  };

  const matches = () => {
    if (!query) return [];
    const q = query.toLowerCase();
    return pipelines?.filter(p => p.name.toLowerCase().includes(q)) ?? [];
  }

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
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="submit" form="modal-form">Create</button>
    </>
  ) :
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onEditOrDeleteClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="submit" form="modal-form">Save Changes</button>
    </>
  );

  return (
    <>
      <Modal action={mode === 'create' ? createFormAction : editFormAction} title={title} subtitle={subtitle} icon={icon} onClose={onClose} footer={footer} mode={mode}>
        {mode === 'view' ? (
          <>
            <div className={styles.fieldGroup}>
              <label>Pipeline to trigger</label>
              <div className={styles.selectWrapper}>
                <ion-icon name="link-outline" className={styles.selectIconLeft}></ion-icon>
                <span>{pipelineName}</span>
              </div>
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
                    .map(e => <span key={e.key} className={styles.branchPill}>{e.label}</span>)}
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
              <input type="hidden" name="pipeline_id" value={selectedPipelineId ?? ''} />
              <div className={styles.autocompleteWrapper}>
                <input
                  type="text"
                  id="pipeline-name"
                  name="pipeline_name"
                  placeholder="e.g. deploy-api"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedPipelineId(null);
                    setOpenMatches(true);
                  }}
                  onFocus={() => setOpenMatches(true)}
                  onBlur={() => setTimeout(() => setOpenMatches(false), 100)}
                  required
                />
                {openMatches && query && (
                  <ul className={styles.autocompleteList}>
                    {matches().length > 0 ? (
                      matches().map(p => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={styles.autocompleteOption}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setQuery(p.name);
                              setSelectedPipelineId(p.id);
                              setOpenMatches(false);
                            }}
                          >
                            <span>{p.name}</span>
                            <span className={styles.autocompleteMuted}>{p.repoUrl}</span>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className={styles.autocompleteEmpty}>No matching pipelines</li>
                    )}
                  </ul>
                )}
              </div>
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
                        className={styles.secretInput}
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
