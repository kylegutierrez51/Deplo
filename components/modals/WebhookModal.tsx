"use client"

import { useState, useRef } from 'react';
import Modal from './Modal';
import modalStyles from './modal.module.css';
import webhookStyles from './webhook-modal.module.css';

const styles = { ...modalStyles, ...webhookStyles };

interface WebhookEvents {
  push?: boolean;
  pullRequest?: boolean;
}

interface WebhookModalProps {
  initialMode?: 'view' | 'edit' | 'create';
  repository?: string;
  pipeline?: string;
  branchFilters?: string[];
  events?: WebhookEvents;
  webhookSecret?: string;
  onClose: () => void;
  onDelete?: () => void;
  onSave?: () => void;
}

export default function WebhookModal({
  initialMode = 'view',
  repository,
  pipeline,
  branchFilters = [],
  events = {},
  webhookSecret = '',
  onClose,
  onDelete,
  onSave,
}: WebhookModalProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);
  const [filters, setBranchFilters] = useState<string[]>(branchFilters);
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvents>(events);
  const [secretVisible, setSecretVisible] = useState(false);
  const [secret, setSecret] = useState(webhookSecret);
  const [copied, setCopied] = useState(false);
  const branchInputRef = useRef<HTMLInputElement>(null);

  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = branchInputRef.current?.value.trim();
    if (!value) return;
    setBranchFilters(prev => [...prev, value]);
    if (branchInputRef.current) branchInputRef.current.value = '';
  };

  const toggleEvent = (key: keyof WebhookEvents) => {
    setSelectedEvents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = () => {
    const chars = 'abcdef0123456789';
    const random = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setSecret(`whsec_${random}`);
  };

  const title = mode === 'view' ? 'Webhook' : (mode === 'create' ? 'Add Webhook' : 'Edit Webhook');
  const subtitle = mode === 'edit' || mode === 'create' ? 'Register a GitHub webhook to trigger a pipeline automatically.' : undefined;
  const icon = mode === 'edit' || mode === 'create' ? 'git-network-outline' : undefined;

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

  const EVENT_DEFS = [
    { key: 'push' as const, label: 'Push', desc: 'Triggered when commits are pushed to a branch' },
    { key: 'pullRequest' as const, label: 'Pull Request', desc: 'Triggered on PR open, sync, or merge' },
  ];

  return (
    <Modal title={title} subtitle={subtitle} icon={icon} onClose={onClose} footer={footer} mode={mode}>
      {mode === 'view' ? (
        <>
          <div className={styles.fieldGroup}>
            <label>Repository</label>
            <div className={styles.selectWrapper}>
              <ion-icon name="git-branch-outline" className={styles.selectIconLeft}></ion-icon>
              <span>{repository}</span>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Pipeline to trigger</label>
            <div className={styles.selectWrapper}>
              <ion-icon name="link-outline" className={styles.selectIconLeft}></ion-icon>
              <span>{pipeline}</span>
            </div>
          </div>

          {filters.length > 0 && (
            <div className={styles.fieldGroup}>
              <label>Branch filters <span className={styles.optionalBadge}>optional</span></label>
              <div className={styles.branchPills}>
                {filters.map((p, i) => <span key={i} className={styles.branchPill}>{p}</span>)}
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label>Trigger events</label>
            <div className={styles.eventCards}>
              {EVENT_DEFS.map(({ key, label, desc }) => (
                <div key={key} className={`${styles.eventCard} ${selectedEvents[key] ? styles.eventCardChecked : ''}`}>
                  <div className={styles.eventCardCheckbox}>
                    <span className={`${styles.customCheckbox} ${selectedEvents[key] ? styles.customCheckboxChecked : ''}`}></span>
                  </div>
                  <div className={styles.eventCardContent}>
                    <span className={styles.eventName}>{label}</span>
                    <span className={styles.eventDesc}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabelRow}>
              <label>Webhook secret</label>
            </div>
            <div className={styles.secretInputWrapper}>
              <ion-icon name="key-outline" className={styles.inputIconLeft}></ion-icon>
              <input
                type={secretVisible ? 'text' : 'password'}
                value={secret}
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
        </>
      ) : (
        <>
          <div className={styles.fieldGroup}>
            <label htmlFor="webhook-repo">Repository</label>
            <div className={styles.selectWrapper}>
              <ion-icon name="git-branch-outline" className={styles.selectIconLeft}></ion-icon>
              <select id="webhook-repo" name="repository" defaultValue={repository ?? ''}>
                <option value="">Select a repository...</option>
                {repository && <option value={repository}>{repository}</option>}
              </select>
              <ion-icon name="chevron-down-outline" className={styles.selectIconRight}></ion-icon>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="webhook-pipeline">Pipeline to trigger</label>
            <div className={styles.selectWrapper}>
              <ion-icon name="link-outline" className={styles.selectIconLeft}></ion-icon>
              <select id="webhook-pipeline" name="pipeline" defaultValue={pipeline ?? ''}>
                <option value="">Select a pipeline...</option>
                {pipeline && <option value={pipeline}>{pipeline}</option>}
              </select>
              <ion-icon name="chevron-down-outline" className={styles.selectIconRight}></ion-icon>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>
              Branch filters
              <span className={styles.optionalBadge}>optional</span>
            </label>
            <input
              type="text"
              ref={branchInputRef}
              placeholder="e.g. main, release/*, feature/** — press Enter to add"
              onKeyDown={handleBranchKeyDown}
            />
            <div className={styles.branchPills}>
              {filters.map((p, i) => <span key={i} className={styles.branchPill}>{p}</span>)}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Trigger events</label>
            <div className={styles.eventCards}>
              {EVENT_DEFS.map(({ key, label, desc }) => (
                <label
                  key={key}
                  className={`${styles.eventCard} ${selectedEvents[key] ? styles.eventCardChecked : ''}`}
                >
                  <div className={styles.eventCardCheckbox}>
                    <input type="checkbox" checked={!!selectedEvents[key]} onChange={() => toggleEvent(key)} />
                    <span className={`${styles.customCheckbox} ${selectedEvents[key] ? styles.customCheckboxChecked : ''}`}></span>
                  </div>
                  <div className={styles.eventCardContent}>
                    <span className={styles.eventName}>{label}</span>
                    <span className={styles.eventDesc}>{desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabelRow}>
              <label htmlFor="webhook-secret">Webhook secret</label>
              <button type="button" className={styles.regenerateBtn} onClick={handleRegenerate} title="Regenerate secret">
                <ion-icon name="refresh-outline"></ion-icon>
              </button>
            </div>
            <div className={styles.secretInputWrapper}>
              <ion-icon name="key-outline" className={styles.inputIconLeft}></ion-icon>
              <input
                type={secretVisible ? 'text' : 'password'}
                id="webhook-secret"
                name="webhook_secret"
                value={secret}
                onChange={e => setSecret(e.target.value)}
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
            <p className={styles.fieldHint}>
              <ion-icon name="information-circle-outline"></ion-icon>
              Used for HMAC-SHA256 signature validation. Store securely — it won&apos;t be shown again.
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}
