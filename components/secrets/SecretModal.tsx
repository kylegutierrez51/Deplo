"use client"

import { useState, useActionState } from 'react';
import { formatDate } from "@/lib/utils/date"
import type { FormState, EnvType } from "@/lib/types.ts";
import type { Environment } from "@/lib/data/environments";
import Modal from '@/components/ui/modals/Modal';
import ConfirmationModal from "@/components/ui/modals/ConfirmationModal";
import modalStyles from '@/components/ui/modals/modal.module.css';
import secretStyles from './secret-modal.module.css';
import Pill from '@/components/ui/Pill';
import { addSecret, updateSecret, deleteSecret } from '@/lib/actions/secrets';
import { MIN_MASKABLE_LENGTH } from '@/lib/secret-mask';

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
  const [deleteModal, setDeleteModal] = useState(false);
  const [, createFormAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addSecret(prev, formData);
    if (result.status === 'success') onCreate(result.message);
    else if (result.status === 'error') onError(result.message);
    return result;
  }, initialState);
  const [, editFormAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateSecret(prev, formData);
    if (result.status === 'success') onSave(result.message);
    else if (result.status === 'error') onError(result.message);
    return result;
  }, initialState);

  const handleDeleteClose = () => {
    setDeleteModal(false);
    onEditOrDeleteClose();
  }

  const deleteRecord = async () => {
    const deletedRecord = await deleteSecret(id);
    if (deletedRecord.status === 'success') {
      onDelete(deletedRecord.message);
    }
    else if (deletedRecord.status === 'error') {
      onError(deletedRecord.message);
    }
    setDeleteModal(false);
  }

  const matches = () => {
    if (!query) return [];
    const q = query.toLowerCase();
    return environments?.filter(env => env.name.toLowerCase().includes(q)) ?? [];
  }

  const results = matches();

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const formAction = mode === 'create' ? createFormAction : editFormAction;

  const submit = (formData: FormData) => {
    formData.set('value', String(formData.get('value') ?? '').trim());
    formAction(formData);
  };

  const title = mode === 'view' ? 'Secret' : ((mode === 'create' ? 'Add Secret' : 'Edit Secret'));

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
      <Modal action={submit} title={title} onClose={onClose} footer={footer} mode={mode}>
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
                {environmentName ? 
                  <>
                    {environmentName} <Pill variant={environmentType} label={environmentType} /> 
                  </>
                  : "None"
                }
                
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
                  minLength={MIN_MASKABLE_LENGTH}
                  onBlur={e => { e.currentTarget.value = e.currentTarget.value.trim(); }}
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
                    {results.length > 0 ? (
                      results.map(env => (
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

      {deleteModal &&
        <ConfirmationModal message={'Delete this Secret?'} action={"Delete"} handleConfirmation={deleteRecord} onClose={handleDeleteClose} timeoutMs={2000} />
      }
    </>
  );
}
