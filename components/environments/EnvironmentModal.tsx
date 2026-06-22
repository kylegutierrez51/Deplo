"use client"

import { capitalize } from "@/lib/utils/string";
import { useState } from 'react';
import Modal from '../modals/Modal';
import modalStyles from '../modals/modal.module.css';
import envStyles from './environment-modal.module.css';
import Pill from '@/components/Pill';



const styles = { ...modalStyles, ...envStyles };

type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

interface EnvironmentModalProps {
  mode: 'view' | 'edit' | 'create';
  name?: string;
  type?: EnvType;
  secrets?: number;
  pipelines?: number;
  requireApproval?: boolean;
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

const ENV_TYPES: { key: EnvType; label: string; baseClass: string; activeClass: string }[] = [
  { key: 'production', label: 'Production', baseClass: styles.typeBtnProduction, activeClass: styles.typeBtnProductionActive },
  { key: 'staging', label: 'Staging', baseClass: styles.typeBtnStaging, activeClass: styles.typeBtnStagingActive },
  { key: 'development', label: 'Development', baseClass: styles.typeBtnDevelopment, activeClass: styles.typeBtnDevelopmentActive },
  { key: 'preview', label: 'Preview', baseClass: styles.typeBtnPreview, activeClass: styles.typeBtnPreviewActive },
  { key: 'custom', label: 'Custom', baseClass: styles.typeBtnCustom, activeClass: styles.typeBtnCustomActive },
];

export default function EnvironmentModal({
  mode = 'view',
  name,
  type = 'production',
  secrets,
  pipelines,
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

  const title = mode === 'view' ? 'Environment' : (name ? 'Edit Environment' : 'Add Environment');

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
            {secrets &&
              <div className={styles.item}>
                <label>Secrets</label>
                <span className={styles.secrets}>
                  <ion-icon name="key-outline"></ion-icon>
                  {secrets}
                </span>
              </div>
            }
            {pipelines &&
              <div className={styles.item}>
                <label>Pipelines</label>
                <span>{pipelines}</span>
              </div>
            }
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
            <input name="env_name" placeholder="e.g. staging, qa-integration" defaultValue={name} />
            <span className={styles.nameHint}>Lowercase letters, numbers, and hyphens only. This is the key used to scope secrets and pipeline targets.</span>
          </div>

          <div className={styles.item}>
            <label>Type</label>
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
