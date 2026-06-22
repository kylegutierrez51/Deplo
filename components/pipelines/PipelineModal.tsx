"use client"

import { capitalize } from "@/lib/utils/string";
import { useState, useRef } from 'react';
import Modal from '../modals/Modal';
import modalStyles from '../modals/modal.module.css';
import pipelineStyles from './pipeline-modal.module.css';
import Pill from '../Pill';

const styles = { ...modalStyles, ...pipelineStyles };

type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface PipelineModalProps {
  mode: 'view' | 'edit' | 'create';
  name?: string;
  status?: PipelineStatus;
  lastRun?: string;
  repoUrl?: string;
  commitMessage?: string;
  description?: string;
  branchFilters?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  onClose: () => void;
  onCreate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditClose: () => void;
  onSave: () => void;
}

export default function PipelineModal({
  mode = 'view',
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
  onEditClose,
  onSave,
}: PipelineModalProps) {
  const [pills, setPills] = useState<string[]>(branchFilters);
  const branchInputRef = useRef<HTMLInputElement>(null);

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
      <button className={`${styles.footerBtn} ${styles.deleteBtn}`} type="button" onClick={onDelete}>Delete</button>
      <button className={`${styles.footerBtn} ${styles.editBtn}`} type="button" onClick={onEdit}>Edit</button>
    </>
  ) : (mode === 'create' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="button" onClick={onCreate}>Create</button>
    </>
  ) :
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onEditClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="button" onClick={onSave}>Save Changes</button>
    </>
  );

  return (
    <Modal title={title} onClose={onClose} footer={footer} mode={mode}>
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
                <span>{lastRun}</span>
              </div>
            }
          </div>


          <div className={styles.item}>
            <label>Repo URL</label>
            <span>{repoUrl}</span>
            <span className={styles['commit-message']}>{commitMessage}</span>
          </div>

          {description && (
            <div className={styles.item}>
              <label>Description <span className={styles.optionalBadge}>optional</span></label>
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
              <span>{createdAt}</span>
            </div>
            <div className={styles.item}>
              <label>Last Updated</label>
              <span>{updatedAt}</span>
            </div>
          </div>

        </>
      ) : (
        <>
          <div className={styles.item}>
            <label>Name</label>
            <input name="name" placeholder="e.g. build-frontend" defaultValue={name} />
          </div>

          <div className={styles.item}>
            <label>Repo URL</label>
            <input name="repo_url" placeholder="e.g. https://github.com/abcd/web-client" defaultValue={repoUrl} />
          </div>

          <div className={styles.item}>
            <label>Description <span className={styles.optionalBadge}>optional</span></label>
            <textarea name="description" placeholder="e.g. Builds and deploys the web client on every push to main" defaultValue={description}></textarea>
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
              {pills.map((p, i) => <span key={i} className={styles.branchPill}>{p}</span>)}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
