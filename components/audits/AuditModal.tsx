"use client"

import { formatDate } from '@/lib/utils/date';
import type { AuditAction, ResourceType } from '@/lib/types';
import Link from 'next/link';
import Modal from '@/components/ui/modals/Modal';
import modalStyles from '@/components/ui/modals/modal.module.css';
import auditStyles from './audit-modal.module.css';
import ResourceTypePill from './ResourceTypePill';
import { resourceHref } from './resourcePath';

const styles = { ...modalStyles, ...auditStyles };

interface AuditModalProps {
  mode?: 'view' | 'edit' | 'create';
  action?: AuditAction;
  resourceType: ResourceType;
  resourceLabel: string | null;
  resourceId: string | null;
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
  resourceId,
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
            <label>Type</label>
            <span><ResourceTypePill type={resourceType} /></span>
          </div>
        </div>


        <div className={styles.item}>
          <label>Resource</label>
          <span>{resourceLabel ?? '—'}</span>
        </div>

        {resourceId &&
          <div className={styles.item}>
            <label>View Resource</label>
            <span>
              <Link href={resourceHref(resourceType, resourceId)} className={styles['resource-link']} target="_blank">
                <ion-icon name="open-outline"></ion-icon>
              </Link>
            </span>
          </div>
        }

        <div className={styles['footer-flex']}>
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
