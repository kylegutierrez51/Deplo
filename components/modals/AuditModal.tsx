"use client"

import Modal from './Modal';
import modalStyles from './modal.module.css';
import auditStyles from './audit-modal.module.css';

const styles = { ...modalStyles, ...auditStyles };

interface AuditModalProps {
  initialMode?: 'view' | 'edit' | 'create';
  action?: string;
  resource?: string;
  category?: string;
  actor?: string;
  time?: string;
  onClose: () => void;
}

export default function AuditModal({
  initialMode = 'view',
  action,
  resource,
  category,
  actor,
  time,
  onClose,
}: AuditModalProps) {
  const footer =
    <>
      <button className={`${styles.footerBtn} ${styles.cancelBtn}`} type="button" onClick={onClose}>Close</button>
    </>

  return (
    <Modal title={"Log"} onClose={onClose} footer={footer} mode={initialMode}>
      <>
        <div className={styles['item-flex']}>
          <div className={styles.item}>
            <label>Action</label>
            <span>{action}</span>
          </div>
          <div className={styles.item}>
            <label>Category</label>
            <span>{category}</span>
          </div>
        </div>


        <div className={styles.item}>
          <label>Resource</label>
          <span>{resource}</span>
        </div>

        <div className={styles['time-flex']}>
          <div className={styles.item}>
            <label>Actor</label>
            <span>{actor || 'Unknown User'}</span>
          </div>
          <div className={styles.item}>
            <label>Time</label>
            <span>{time}</span>
          </div>
        </div>

      </>
    </Modal>
  );
}
