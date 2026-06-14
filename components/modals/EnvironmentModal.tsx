"use client"

import { useState } from 'react';
import Modal from './Modal';
import modalStyles from './modal.module.css';
import envStyles from './environment-modal.module.css';
import Pill from '@/components/Pill';

const styles = { ...modalStyles, ...envStyles };

type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

interface EnvironmentModalProps {
  initialMode?: 'view' | 'edit' | 'create';
  name?: string;
  type?: EnvType;
  requireApproval?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  onClose: () => void;
  onDelete?: () => void;
  onSave?: () => void;
}

const ENV_TYPES: { key: EnvType; label: string; baseClass: string; activeClass: string }[] = [
  { key: 'production',  label: 'Production',  baseClass: styles.typeBtnProduction,  activeClass: styles.typeBtnProductionActive  },
  { key: 'staging',     label: 'Staging',     baseClass: styles.typeBtnStaging,     activeClass: styles.typeBtnStagingActive     },
  { key: 'development', label: 'Development', baseClass: styles.typeBtnDevelopment, activeClass: styles.typeBtnDevelopmentActive },
  { key: 'preview',     label: 'Preview',     baseClass: styles.typeBtnPreview,     activeClass: styles.typeBtnPreviewActive     },
  { key: 'custom',      label: 'Custom',      baseClass: styles.typeBtnCustom,      activeClass: styles.typeBtnCustomActive      },
];

export default function EnvironmentModal({
  initialMode = 'view',
  name,
  type = 'production',
  requireApproval = false,
  createdBy,
  createdAt,
  updatedAt,
  onClose,
  onDelete,
  onSave,
}: EnvironmentModalProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);
  const [envType, setEnvType] = useState<EnvType>(type);
  const [approvalEnabled, setApprovalEnabled] = useState(requireApproval);

  const title = mode === 'view' ? 'Environment' : (name ? 'Edit Environment' : 'Add Environment');

  const footer = mode === 'view' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.deleteBtn}`} type="button" onClick={onDelete}>Delete</button>
      <button className={`${styles.footerBtn} ${styles.editBtn}`} type="button" onClick={() => setMode('edit')}>Edit</button>
    </>
  ) : (mode === 'create' ? (
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Cancel</button>
      <button className={`${styles.footerBtn} ${styles.createBtn}`} type="button" onClick={onSave}>Create</button>
    </>
  ) :
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Cancel</button>
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
              <Pill variant={envType} label={envType.charAt(0).toUpperCase() + envType.slice(1)} />
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
