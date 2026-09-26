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
