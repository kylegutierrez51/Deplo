"use client"

import { capitalize } from "@/lib/utils/string";
import { formatDate } from "@/lib/utils/date";
import { useState, useRef, useEffect, useActionState } from 'react';
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
  branchFilters: string[];
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
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

export default function PipelineModal({
  mode = 'view',
  id,
  name,
  status,
  lastRun,
  repoUrl,
  commitMessage,
  description,
  branchFilters = [],
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
  const [pills, setPills] = useState<string[]>(branchFilters);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [createState, createFormAction] = useActionState(addPipeline, initialState);
  const [editState, editFormAction] = useActionState(updatePipeline, initialState);

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
      onError(createState.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- don't add onSave as a dep so that this effect doesn't rerun when CrudModalController re-renders via showToast() and hands down a new function reference
  }, [editState]);

  const handleDeleteClose = () => {
    setDeleteModal(false);
    onEditOrDeleteClose();
  }

  const deleteRecord = async () => {
    const deletedRecord = await deletePipeline(id);
    if (deletedRecord.status === 'success') {
      onDelete();
    }
    else if (deletedRecord.status === 'error') {
      onError(deletedRecord.message);
    }
  }

  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = branchInputRef.current?.value.trim();
    if (!value) return;
    setPills(prev => [...prev, value]);
    if (branchInputRef.current) branchInputRef.current.value = '';
  };



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
      <Modal action={mode === 'create' ? createFormAction : editFormAction} title={title} onClose={onClose} footer={footer} mode={mode}>
        {mode === 'view' ? (
          <>
            <div className={styles['item-flex']}>
              <div className={styles.item}>
                <label>Name</label>
                <span>{name}</span>
              </div>

              {status &&
                <div className={styles.item}>
                  <label>Status</label>
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
            {branchFilters.length > 0 && (
              <div className={styles.item}>
                <label>Branch Filters</label>
                <div className={styles.branchPills}>
                  {pills.map((p, i) => <span key={i} className={styles.branchPill}>{p}</span>)}
                </div>
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
              <input name="name" id="name" placeholder="e.g. build-frontend" defaultValue={name} required />
            </div>

            <div className={styles.item}>
              <label htmlFor="repo_url">Repo URL</label>
              <input name="repo_url" id="repo_url" placeholder="e.g. https://github.com/abcd/web-client" defaultValue={repoUrl || ''} />
            </div>

            <div className={styles.item}>
              <label htmlFor="description">Description <span className={styles.optionalBadge}>optional</span></label>
              <textarea name="description" id="description" placeholder="e.g. Builds and deploys the web client on every push to main" defaultValue={description || ''}></textarea>
            </div>

            <div className={styles.item}>
              <label>
                Branch Filters
                <span className={styles.optionalBadge}>optional</span>
              </label>
              <input
                type="text"
                ref={branchInputRef}
                placeholder="e.g. main, release/* — press Enter to add"
                onKeyDown={handleBranchKeyDown}
              />
              <p className={styles.fieldHint}>
                <ion-icon name="information-circle-outline"></ion-icon>
                Glob pattern. Leave empty to trigger on all branches.
              </p>
              <div className={styles.branchPills}>
                {pills.map((p, i) =>
                  <span key={i} className={styles.branchPill}>
                    {p}
                    <input type="hidden" name="branch_filters" id="branch_filters" value={p} />
                  </span>)}
              </div>
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
