"use client"

import { capitalize } from "@/lib/utils/string";
import { formatDate } from "@/lib/utils/date";
import { useEffect, useState, useActionState } from 'react';
import { addEnvironment, updateEnvironment, deleteEnvironment } from "@/lib/actions/environments";
import type { FormState, EnvType } from '@/lib/types';
import Modal from '@/components/ui/modals/Modal';
import ConfirmationModal from "@/components/ui/modals/ConfirmationModal";
import Pill from '@/components/ui/Pill';
import modalStyles from '@/components/ui/modals/modal.module.css';
import envStyles from './environment-modal.module.css';


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
  onEditOrDeleteClose: () => void;
  onSave: () => void;
  onError: (message: string) => void;
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
  onEditOrDeleteClose,
  onSave,
  onError,
}: EnvironmentModalProps) {
  const [envType, setEnvType] = useState<EnvType>(type);
  const [approvalEnabled, setApprovalEnabled] = useState(requireApproval);
  const [createState, createFormAction] = useActionState(addEnvironment, initialState);
  const [editState, editFormAction] = useActionState(updateEnvironment, initialState);
  const [deleteModal, setDeleteModal] = useState(false);

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
    const deletedRecord = await deleteEnvironment(id);
    if (deletedRecord.status === 'success') {
      onDelete();
    }
    else if (deletedRecord.status === 'error') {
      onError(deletedRecord.message);
    }
  }

  const title = mode === 'view' ? 'Environment' : (name ? 'Edit Environment' : 'Add Environment');

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

            <div className={styles.item}>
              <label>Deploy approval</label>
              <span className={styles.secrets}>
                <ion-icon name={requireApproval ? 'lock-closed-outline' : 'lock-open-outline'}></ion-icon>
                {requireApproval ? 'Required' : 'Not required'}
              </span>
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
                    Pipeline runs targeting this environment will be rejected unless every deploy stage has an approval stage upstream.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {deleteModal &&
        <ConfirmationModal message={'Delete this Environment?'} action={"Delete"} handleConfirmation={deleteRecord} onClose={handleDeleteClose} timeoutMs={2000} />
      }
    </>
  );
}
