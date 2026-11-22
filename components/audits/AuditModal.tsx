"use client"

import { formatDate } from '@/lib/utils/date';
import type { AuditAction, AuditMeta, ResourceType } from '@/lib/types';
import Link from 'next/link';
import Modal from '@/components/ui/modals/Modal';
import styles from '@/components/ui/modals/resource-modal.module.css';
import ResourceTypePill from './ResourceTypePill';
import AuditResourceLabel from './AuditResourceLabel';
import { resourceHref } from './resourcePath';

interface AuditModalProps {
  mode?: 'view' | 'edit' | 'create';
  action?: AuditAction;
  resourceType: ResourceType;
  resourceLabel: string | null;
  resourceMeta: AuditMeta | null;
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
  resourceMeta,
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
    <Modal title="Audit log entry" subtitle="Action, resource, and actor details." classNames={styles} onClose={onClose} footer={footer} mode={mode}>
      <>
        <div className={styles.detailsGrid}>
          <div className={`${styles.item} ${styles.identity}`}>
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
          <div className={styles.detailValue}><AuditResourceLabel resourceLabel={resourceLabel} resourceMeta={resourceMeta} /></div>
          {resourceId && (
            <Link href={resourceHref(resourceType, resourceId)} className={styles.detailLink} target="_blank">
              View resource
              <ion-icon name="open-outline"></ion-icon>
            </Link>
          )}
        </div>

        <div className={styles.metadataGrid}>
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
