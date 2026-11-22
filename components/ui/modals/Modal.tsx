"use client"

import styles from './modal.module.css';

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: string;
  mode: 'view' | 'edit' | 'create';
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
  action?: (formData: FormData) => void | Promise<void>;
  pending?: boolean;
  classNames?: Partial<Record<'container' | 'header' | 'titleGroup' | 'closeBtn' | 'formItems' | 'footer', string>>;
}

export default function Modal({ title, subtitle, icon, mode, onClose, footer, children, action, pending = false, classNames = {} }: ModalProps) {
  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} onClick={mode === 'view' ? onClose : undefined}>
      <div className={`${styles.container} ${classNames.container ?? ''}`} onClick={e => e.stopPropagation()}>

        <div className={`${styles.header} ${classNames.header ?? ''}`}>
          <div className={styles.headerLeft}>
            {icon && (
              <div className={styles.iconBox}>
                <ion-icon name={icon}></ion-icon>
              </div>
            )}
            <div className={`${styles.titleGroup} ${classNames.titleGroup ?? ''}`}>
              <h3>{title}</h3>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className={`${styles.closeBtn} ${classNames.closeBtn ?? ''}`} type="button" aria-label="Close" onClick={onClose} disabled={pending}>
            <ion-icon name="close-outline"></ion-icon>
          </button>
        </div>

        <form id="modal-form" action={action} className={styles.form}>
          <div className={`${styles.formItems} ${classNames.formItems ?? ''}`}>
            {children}
          </div>
        </form>

        <div className={`${styles.footer} ${classNames.footer ?? ''}`}>
          {footer}
        </div>

      </div>
    </div>
  );
}
