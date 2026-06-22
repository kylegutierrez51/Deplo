"use client"

import { useState } from 'react';
import Modal from '../modals/Modal';
import modalStyles from '../modals/modal.module.css';
import secretStyles from './secret-modal.module.css';
import Pill from '@/components/Pill';

const styles = { ...modalStyles, ...secretStyles };

type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

interface SecretModalProps {
  mode: 'view' | 'edit' | 'create';
  secretKey?: string;
  value?: string;
  environmentType?: EnvType;
  notes?: string;
  createdBy?: string | null;
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

export default function SecretModal({
  mode = 'view',
  secretKey,
  value,
  environmentType = 'production',
  notes,
  createdBy,
  createdAt,
  updatedAt,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onEditClose,
  onSave,
}: SecretModalProps) {
  const [envType, setEnvType] = useState<EnvType>(environmentType);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }

  };

  const title = mode === 'view' ? 'Secret' : ((mode === 'create' ? 'Add Secret' : 'Edit Secret'));

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
            <label>Key</label>
            <span>{secretKey}</span>
          </div>

          <div className={styles.item}>
            <div className={styles.fieldLabelRow}>
              <label htmlFor="secret-value">Value</label>
            </div>
            <div className={styles.secretInputWrapper}>
              <ion-icon name="key-outline" className={styles.inputIconLeft}></ion-icon>
              <input
                type={secretVisible ? 'text' : 'password'}
                value={value}
                readOnly
                className={styles.secretInput}
              />
              <div className={styles.secretActions}>
                <button type="button" className={styles.iconActionBtn} onClick={() => setSecretVisible(v => !v)}>
                  <ion-icon name={secretVisible ? 'eye-off-outline' : 'eye-outline'}></ion-icon>
                </button>
                <span className={styles.secretDivider}></span>
                <button type="button" className={styles.iconActionBtn} onClick={handleCopy}>
                  <ion-icon name={copied ? 'checkmark-outline' : 'copy-outline'}></ion-icon>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.item}>
            <label>Environment Type</label>
            <div className={styles.buttonGroup}>
              <Pill variant={envType} label={environmentType ?? ''} />
            </div>
          </div>

          {notes && (
            <div className={styles.item}>
              <label>Notes <span className={styles.optionalBadge}>optional</span></label>
              <span>{notes}</span>
            </div>
          )}

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
            <label>Key</label>
            <input name="secret_key" placeholder="e.g. DATABASE_URL" defaultValue={secretKey} />
          </div>

          <div className={styles.item}>
            <label>Value</label>
            <div className={styles.valueInputWrapper}>
              <input
                type={secretVisible ? 'text' : 'password'}
                name="secret_value"
                placeholder="Secret value - encrypted at rest with AES-256-GCM"
                defaultValue={value}
              ></input>
              <button type="button" className={styles.iconActionBtn} onClick={() => setSecretVisible(v => !v)}>
                <ion-icon
                  name={secretVisible ? 'eye-off-outline' : 'eye-outline'}
                  className={styles.valueToggleIcon}
                ></ion-icon>
              </button>

            </div>
          </div>

          <div className={styles.item}>
            <label>Environment Type</label>
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

          <div className={styles.item}>
            <label>Notes <span className={styles.optionalBadge}>optional</span></label>
            <textarea name="notes" placeholder="e.g. Rotated quarterly, scoped to read-only" defaultValue={notes}></textarea>
          </div>
        </>
      )}
    </Modal>
  );
}
