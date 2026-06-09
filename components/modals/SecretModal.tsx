"use client"

import { useState } from 'react';
import Modal from './Modal';
import modalStyles from './modal.module.css';
import secretStyles from './secret-modal.module.css';
import Pill from '@/components/Pill';

const styles = { ...modalStyles, ...secretStyles };

type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

interface SecretModalProps {
  initialMode?: 'view' | 'edit' | 'create';
  secretKey?: string;
  value?: string;
  environmentType?: EnvType;
  notes?: string;
  createdBy?: string;
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

export default function SecretModal({
  initialMode = 'view',
  secretKey,
  value,
  environmentType = 'production',
  notes,
  createdBy,
  onClose,
  onDelete,
  onSave,
}: SecretModalProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);
  const [envType, setEnvType] = useState<EnvType>(environmentType);
  const [valueVisible, setValueVisible] = useState(false);

  const title = mode === 'view' ? 'Secret' : ((mode === 'create' ? 'Add Secret' : 'Edit Secret'));

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
            <label>Key</label>
            <span>{secretKey}</span>
          </div>

          <div className={styles.item}>
            <label>Value</label>
            <div className={styles.valueInputWrapper}>
              <div className={styles.secretWrapper}>
                <span>{valueVisible ? value : '••••••••••••••••••••••••'}</span>
                <ion-icon
                  name={valueVisible ? 'eye-off-outline' : 'eye-outline'}
                  onClick={() => setValueVisible(v => !v)}
                ></ion-icon>
              </div>
            </div>
          </div>

          <div className={styles.item}>
            <label>Environment Type</label>
            <div className={styles.buttonGroup}>
              <Pill variant={envType} label={envType.charAt(0).toUpperCase() + envType.slice(1)} />
            </div>
          </div>

          {notes && (
            <div className={styles.item}>
              <label>Notes <span className={styles.optionalBadge}>optional</span></label>
              <span>{notes}</span>
            </div>
          )}

          <div className={styles.item}>
            <label>Created By</label>
            <span>{createdBy}</span>
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
              <textarea
                name="secret_value"
                placeholder="Secret value - encrypted at rest with AES-256-GCM"
                defaultValue={value}
              ></textarea>
              <ion-icon
                name={valueVisible ? 'eye-off-outline' : 'eye-outline'}
                className={styles.valueToggleIcon}
                onClick={() => setValueVisible(v => !v)}
              ></ion-icon>
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
