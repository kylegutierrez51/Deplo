"use client"

import { capitalize, formatDate } from "@/lib/utils/string";
import { useEffect, useState, useActionState, useTransition } from 'react';
import { addEnvironment, updateEnvironment, deleteEnvironment } from "@/lib/actions/environments";
import { FormState, EnvType } from '@/lib/types';
import Modal from '../modals/Modal';
import modalStyles from '../modals/modal.module.css';
import envStyles from './environment-modal.module.css';
import Pill from '@/components/Pill';

const styles = { ...modalStyles, ...envStyles };

interface EnvironmentModalProps {
  mode: 'view' | 'edit' | 'create';
  id: string;
  name: string;
  type: EnvType;
  secrets: number;
  requireApproval: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  onClose: () => void;
  onCreate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditClose: () => void;
  onSave: () => void;
}

const ENV_TYPES: { key: EnvType; label: string; baseClass: string; activeClass: string }[] = [
  { key: 'production', label: 'Production', baseClass: styles.typeBtnProduction, activeClass: styles.typeBtnProductionActive },
  { key: 'staging', label: 'Staging', baseClass: styles.typeBtnStaging, activeClass: styles.typeBtnStagingActive },
  { key: 'development', label: 'Development', baseClass: styles.typeBtnDevelopment, activeClass: styles.typeBtnDevelopmentActive },
  { key: 'preview', label: 'Preview', baseClass: styles.typeBtnPreview, activeClass: styles.typeBtnPreviewActive },
  { key: 'custom', label: 'Custom', baseClass: styles.typeBtnCustom, activeClass: styles.typeBtnCustomActive },
];

const initialState: FormState = {
  status: 'idle',
  message: '',
}

export default function EnvironmentModal({
  mode = 'view',
  id,
  name,
  type = 'production',
  secrets,
  requireApproval = false,
  createdBy,
  createdAt,
  updatedAt,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onEditClose,
  onSave,
}: EnvironmentModalProps) {
  const [envType, setEnvType] = useState<EnvType>(type);
  const [approvalEnabled, setApprovalEnabled] = useState(requireApproval);
  const [createState, createFormAction] = useActionState(addEnvironment, initialState);
  const [editState, editFormAction] = useActionState(updateEnvironment, initialState);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (editState.status === 'success') {
      onSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- don't add onSave as a dep so that this effect doesn't rerun when CrudModalController re-renders via showToast() and hands down a new function reference
  }, [editState]);

  useEffect(() => {
    if (createState.status === 'success') {
      onCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createState]);

  const handleDelete = () => startTransition(async () => {
    await deleteEnvironment(id);
    onDelete();
  })



  const title = mode === 'view' ? 'Environment' : (name ? 'Edit Environment' : 'Add Environment');

  const footer = mode === 'view' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.deleteBtn}`} type="button" onClick={handleDelete}>Delete</button>
      <button className={`${styles.footerBtn} ${styles.editBtn}`} type="button" onClick={onEdit}>Edit</button>
    </>
  ) : (mode === 'create' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="submit" form="modal-form" onClick={onCreate}>Create</button>
    </>
  ) :
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onEditClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="submit" form="modal-form">Save Changes</button>
    </>
  );

  return (
    <Modal action={mode === 'create' ? createFormAction : editFormAction} title={title} onClose={onClose} footer={footer} mode={mode}>
      {mode === 'view' ? (
        <>
          <div className={styles.item}>
            <label>Name</label>
            <span>{name}</span>
          </div>

          <div className={styles.item}>
            <label>Type</label>
            <div>
              <Pill variant={envType} label={capitalize(envType)} />
            </div>
          </div>

          <div className={styles['secrets-pipelines-flex']}>
            <div className={styles.item}>
              <label>Secrets</label>
              <span className={styles.secrets}>
                <ion-icon name="key-outline"></ion-icon>
                {secrets}
              </span>
            </div>
          </div>

          <div
            className={styles.approvalToggleBox}
            onClick={() => setApprovalEnabled(v => !v)}
          >
            <div className={styles.toggleOption}>
              <span className={`${styles.toggleSwitch} ${approvalEnabled ? styles.toggleSwitchOn : ''}`}></span>
              <div className={styles.toggleContent}>
                <div className={styles.toggleTitle}>
                  <ion-icon name="lock-closed-outline"></ion-icon>
                  Require approval for deploys
                </div>
                <p className={styles.toggleDescription}>
                  Pipeline runs targeting this environment will pause at a manual approval gate before executing deploy stages.
                </p>
              </div>
            </div>
          </div>

          <div className={styles['item-flex']}>
            <div className={styles.item}>
              <label>Created By</label>
              <span>{createdBy || 'Unknown User'}</span>
            </div>
            <div className={styles.item}>
              <label>Created At</label>
              <span>{createdAt && formatDate(createdAt)}</span>
            </div>
            <div className={styles.item}>
              <label>Last Updated</label>
              <span>{updatedAt && formatDate(updatedAt)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="id" value={id ?? ''} />
          <div className={styles.item}>
            <label htmlFor="name">Name</label>
            <input name="name" id="name" placeholder="e.g. staging, qa-integration" defaultValue={name} required />
            <span className={styles.nameHint}>Lowercase letters, numbers, and hyphens only. This is the key used to scope secrets and pipeline targets.</span>
          </div>

          <div className={styles.item}>
            <label>Type</label>
            <input type="hidden" name="type" value={envType} />
            <div className={styles.buttonGroup}>
              {ENV_TYPES.map(({ key, label, baseClass, activeClass }) => (
                <button
                  key={key}
                  className={`${styles.typeBtn} ${baseClass} ${envType === key ? activeClass : ''}`}
                  type="button"
                  onClick={() => setEnvType(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={styles.approvalToggleBox}
            onClick={() => setApprovalEnabled(v => !v)}
          >
            <input type="hidden" name="requireApproval" value={approvalEnabled ? 'true' : 'false'} />
            <div className={styles.toggleOption}>
              <span className={`${styles.toggleSwitch} ${approvalEnabled ? styles.toggleSwitchOn : ''}`}></span>
              <div className={styles.toggleContent}>
                <div className={styles.toggleTitle}>
                  <ion-icon name="lock-closed-outline"></ion-icon>
                  Require approval for deploys
                </div>
                <p className={styles.toggleDescription}>
                  Pipeline runs targeting this environment will pause at a manual approval gate before executing deploy stages.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
