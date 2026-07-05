"use client"

import { formatDate } from '@/lib/utils/string';
import type { ResourceType } from '@/lib/types';
import Modal from '../modals/Modal';
import modalStyles from '../modals/modal.module.css';
import auditStyles from './audit-modal.module.css';

const styles = { ...modalStyles, ...auditStyles };

interface AuditModalProps {
  mode?: 'view' | 'edit' | 'create';
  id: string;
  action?: string;
  resourceType: ResourceType;
  resourceLabel: string | null;
  category?: string;
  actor: string | null;
  user: string | null;
  createdAt: Date;
  onClose: () => void;
}

export default function AuditModal({
  mode = 'view',
  action,
  resourceType,
  resourceLabel,
  actor,
  user,
  createdAt,
  onClose,
}: AuditModalProps) {
  
  const footer =
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Close</button>
    </>

  return (
    <Modal title={"Log"} onClose={onClose} footer={footer} mode={mode}>
      <>
        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Action</label>
            <span>{action}</span>
          </div>
          <div className={styles.item}>
            <label>Category</label>
            <span>{resourceType}</span>
          </div>
        </div>


        <div className={styles.item}>
          <label>Resource</label>
          <span>{resourceLabel ?? '—'}</span>
        </div>

        <div className={styles['time-flex']}>
          <div className={styles.item}>
            <label>Actor</label>
            <span>{user ?? actor ?? 'Unknown User'}</span>
          </div>
          <div className={styles.item}>
            <label>Time</label>
            <span>{formatDate(createdAt)}</span>
          </div>
        </div>
      </>
    </Modal>
  );
}
