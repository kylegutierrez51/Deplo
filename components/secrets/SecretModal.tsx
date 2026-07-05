"use client"

import { useState, useEffect, useActionState } from 'react';
import { formatDate } from "@/lib/utils/string"
import type { FormState, EnvType } from "@/lib/types.ts";
import type { Environment } from "@/lib/data/environments";
import Modal from '../modals/Modal';
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import modalStyles from '../modals/modal.module.css';
import secretStyles from './secret-modal.module.css';
import Pill from '@/components/Pill';
import { addSecret, updateSecret, deleteSecret } from '@/lib/actions/secrets';

const styles = { ...modalStyles, ...secretStyles };

interface SecretModalProps {
  mode: 'view' | 'edit' | 'create';
  id: string,
  secretKey: string;
  value: string;
  environmentName: string;
  environmentType: EnvType;
  notes: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  environments: Environment[] | null;
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

export default function SecretModal({
  mode = 'view',
  id,
  secretKey,
  value,
  environmentName,
  environmentType,
  notes,
  createdBy,
  createdAt,
  updatedAt,
  environments,
  onClose,
  onCreate,
  onDelete,
  onEdit,
  onEditOrDeleteClose,
  onSave,
  onError
}: SecretModalProps) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState(environmentName ?? "");
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(
    environments?.find(env => env.name === environmentName)?.id ?? null
  );
  const [openMatches, setOpenMatches] = useState(false);
  const [isDeleteModalVisible, setisDeleteModalVisible] = useState(false);
  const [createState, createFormAction] = useActionState(addSecret, initialState);
  const [editState, editFormAction] = useActionState(updateSecret, initialState);

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
    setisDeleteModalVisible(false);
    onEditOrDeleteClose();
  }

  const matches = () => {
    if (!query) return [];
    const q = query.toLowerCase();
    return environments?.filter(env => env.name.toLowerCase().includes(q)) ?? [];
  }

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
      <button className={`${styles.footerBtn} ${styles.deleteBtn}`} type="button" onClick={() => setisDeleteModalVisible(true)}>Delete</button>
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
              <label>Environment</label>
              <div className={styles.buttonGroup}>
                <Pill variant={environmentType} label={environmentName ?? ''} />
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
              <label htmlFor="key">Key</label>
              <input name="key" id="key" placeholder="e.g. DATABASE_URL" defaultValue={secretKey} required />
            </div>

            <div className={styles.item}>
              <label htmlFor="value">Value</label>
              <div className={styles.valueInputWrapper}>
                <input
                  type={secretVisible ? 'text' : 'password'}
                  name="value"
                  key="value"
                  placeholder="Secret value - encrypted at rest with AES-256-GCM"
                  defaultValue={value}
                  required
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
              <label htmlFor="env_name">Environment</label>
              <input type="hidden" name="env_id" value={selectedEnvId ?? ''} />
              <div className={styles.autocompleteWrapper}>
                <input
                  type="text"
                  name="env_name"
                  placeholder="e.g. Production"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedEnvId(null);
                    setOpenMatches(true);
                  }}
                  onFocus={() => setOpenMatches(true)}
                  onBlur={() => setTimeout(() => setOpenMatches(false), 100)}
                  required
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
                              setSelectedEnvId(env.id);
                              setOpenMatches(false);
                            }}
                          >
                            <span>{env.name}</span>
                            <Pill variant={env.type} label={env.type} />
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
              <label htmlFor="notes">Notes <span className={styles.optionalBadge}>optional</span></label>
              <textarea name="notes" id="notes" placeholder="e.g. Rotated quarterly, scoped to read-only" defaultValue={notes || ''}></textarea>
            </div>
          </>
        )}
      </Modal>

      {isDeleteModalVisible &&
        <DeleteConfirmationModal id={id} recordLabel={"Secret"} onDelete={onDelete} onDeleteClose={handleDeleteClose} deleteRecord={deleteSecret} onError={onError} />
      }
    </>
  );
}
