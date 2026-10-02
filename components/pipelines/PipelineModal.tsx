"use client"

import { capitalize } from "@/lib/utils/string";
import { formatDate } from "@/lib/utils/date";
import { useState, useActionState } from 'react';
import Link from 'next/link';
import { addPipeline, updatePipeline, deletePipeline } from "@/lib/actions/pipelines";
import type { PipelineStatus, FormState } from "@/lib/types";
import Modal from '@/components/ui/modals/Modal';
import ConfirmationModal from "@/components/ui/modals/ConfirmationModal";
import modalStyles from '@/components/ui/modals/modal.module.css';
import pipelineStyles from './pipeline-modal.module.css';
import Pill from '@/components/ui/Pill';
import type { Environment } from '@/lib/data/environments';

const styles = { ...modalStyles, ...pipelineStyles };

interface PipelineModalProps {
  mode: 'view' | 'edit' | 'create';
  id: string;
  name: string;
  status: PipelineStatus;
  lastRun: string | null;
  repoUrl: string | null;
  commitMessage?: string | null;
  description: string | null;
  defaultEnvironmentId: string | null;
  defaultEnvironment?: string | null;
  environments: Environment[];
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  onClose: () => void;
  onCreate: (message: string) => void;
  onDelete: (message: string) => void;
  onEdit: () => void;
  onEditOrDeleteClose: () => void;
  onSave: (message: string) => void;
  onError: (message: string) => void;
}

const initialState: FormState = {
  status: 'idle',
  message: '',
}

export default function PipelineModal({
  mode = 'view',
  id,
  name,
  status,
  lastRun,
  repoUrl,
  commitMessage,
  description,
  defaultEnvironmentId,
  defaultEnvironment,
  environments,
  createdBy,
  createdAt,
  updatedAt,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onEditOrDeleteClose,
  onSave,
  onError,
}: PipelineModalProps) {
  const [enteredName, setEnteredName] = useState(name || '');
  const [enteredRepoUrl, setEnteredRepoUrl] = useState(repoUrl || '');
  const [enteredDescription, setEnteredDescription] = useState(description || '');
  const [query, setQuery] = useState(defaultEnvironment ?? '');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(defaultEnvironmentId);
  const [openMatches, setOpenMatches] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [, createFormAction, createPending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addPipeline(prev, formData);
    if (result.status === 'success') onCreate(result.message);
    else if (result.status === 'error') onError(result.message);
    return result;
  }, initialState);
  const [, editFormAction, editPending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updatePipeline(prev, formData);
    if (result.status === 'success') onSave(result.message);
    else if (result.status === 'error') onError(result.message);
    return result;
  }, initialState);
  const pending = createPending || editPending;

  const matches = () => {
    if (!query) return [];
    const q = query.toLowerCase();
    return environments.filter(env => env.name.toLowerCase().includes(q));
  }

  // Typing a name in full counts as picking it
  const exactMatch = () => {
    const q = query.trim().toLowerCase();
    const found = environments.filter(env => env.name.toLowerCase() === q);
    return found.length === 1 ? found[0] : undefined;
  }

  const handleEnvironmentBlur = () => {
    const match = exactMatch();
    if (!selectedEnvironmentId && match) {
      setQuery(match.name);
      setSelectedEnvironmentId(match.id);
    }
    setTimeout(() => setOpenMatches(false), 100);
  }

  const handleDeleteClose = () => {
    setDeleteModal(false);
    onEditOrDeleteClose();
  }

  const deleteRecord = async () => {
    const deletedRecord = await deletePipeline(id);
    if (deletedRecord.status === 'success') {
      onDelete(deletedRecord.message);
    }
    else if (deletedRecord.status === 'error') {
      onError(deletedRecord.message);
    }
    setDeleteModal(false);
  }

  const title = mode === 'view' ? 'Pipeline' : (mode === 'create' ? 'Add Pipeline' : 'Edit Pipeline');

  const footer = mode === 'view' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.deleteBtn}`} type="button" onClick={() => setDeleteModal(true)}>Delete</button>
      {/* Grouped so .footer's space-between still sees two children and keeps Delete on the far edge */}
      <div className={styles.footerActions}>
        <button className={`${styles.footerBtn} ${styles.editBtn}`} type="button" onClick={onEdit}>Edit Details</button>
        <Link href={`/pipelines/${id}`} className={`${styles.footerBtn} ${styles.createBtn}`} target="_blank">Open Editor</Link>
      </div>
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
      <Modal action={mode === 'create' ? createFormAction : editFormAction} pending={pending} title={title} onClose={onClose} footer={footer} mode={mode}>
        {mode === 'view' ? (
          <>
            <div className={styles['item-flex']}>
              <div className={styles.item}>
                <label>Name</label>
                <span>{name}</span>
              </div>

              {status &&
                <div className={styles.item}>
                  <label>Recent Status</label>
                  <span><Pill variant={status} label={capitalize(status)} /></span>
                </div>
              }

              {lastRun &&
                <div className={styles.item}>
                  <label>Last Run</label>
                  <span>
                    <Link href={`/runs/${lastRun}`} className={styles['latest-run-link']} target="_blank">
                      <ion-icon name="open-outline"></ion-icon>
                      View Run
                    </Link>
                  </span>
                </div>
              }
            </div>

            {repoUrl &&
              <div className={styles.item}>
                <label>Repo URL</label>
                <span>{repoUrl}</span>
                <span className={styles['commit-message']}>{commitMessage}</span>
              </div>
            }


            {description && (
              <div className={styles.item}>
                <label>Description</label>
                <span>{description}</span>
              </div>
            )}

            {defaultEnvironment && (
              <div className={styles.item}>
                <label>Default Environment</label>
                <span>{defaultEnvironment}</span>
              </div>
            )}

            <div className={styles['created-updated-flex']}>
              <div className={styles.item}>
                <label>Created By</label>
                <span>{createdBy || 'Unknown User'}</span>
              </div>
              <div className={styles.item}>
                <label>Created At</label>
                <span>{formatDate(createdAt)}</span>
              </div>
              <div className={styles.item}>
                <label>Last Updated</label>
                <span>{formatDate(updatedAt)}</span>
              </div>
            </div>

          </>
        ) : (
          <>
            <input type="hidden" name="id" value={id ?? ''} />
            <div className={styles.item}>
              <label htmlFor="name">Name</label>
              <input name="name" id="name" placeholder="e.g. build-frontend" required
                value={enteredName} onChange={(e) => setEnteredName(e.target.value)} />
            </div>

            <div className={styles.item}>
              <label htmlFor="repo_url">Repo URL <span className={styles.optionalBadge}>optional</span></label>
              <input name="repo_url" id="repo_url" placeholder="e.g. https://github.com/abcd/web-client"
                value={enteredRepoUrl} onChange={(e) => setEnteredRepoUrl(e.target.value)} />
            </div>

            <div className={styles.item}>
              <label htmlFor="default_environment">Default Environment <span className={styles.optionalBadge}>optional</span></label>
              <input type="hidden" name="default_environment_id" value={selectedEnvironmentId ?? exactMatch()?.id ?? ''} />
              <div className={styles.autocompleteWrapper}>
                <input
                  type="text"
                  id="default_environment"
                  placeholder="e.g. staging"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedEnvironmentId(null);
                    setOpenMatches(true);
                  }}
                  onFocus={() => setOpenMatches(true)}
                  onBlur={handleEnvironmentBlur}
                />
                {openMatches && query && (
                  <ul className={styles.autocompleteList}>
                    {matches().length > 0 ? (
                      matches().map(env => (
                        <li key={env.id}>
                          <button
                            type="button"
                            className={styles.autocompleteOption}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setQuery(env.name);
                              setSelectedEnvironmentId(env.id);
                              setOpenMatches(false);
                            }}
                          >
                            <span>{env.name}</span>
                            <span className={styles.autocompleteMuted}>{capitalize(env.type)}</span>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className={styles.autocompleteEmpty}>No matching environments</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div className={styles.item}>
              <label htmlFor="description">Description <span className={styles.optionalBadge}>optional</span></label>
              <textarea name="description" id="description" placeholder="e.g. Builds and deploys the web client on every push to main"
                value={enteredDescription} onChange={(e) => setEnteredDescription(e.target.value)}></textarea>
            </div>
          </>
        )}
      </Modal>

      {deleteModal &&
        <ConfirmationModal message={'Delete this Pipeline?'} action={"Delete"} handleConfirmation={deleteRecord} onClose={handleDeleteClose} timeoutMs={2000} />
      }
    </>
  );
}
