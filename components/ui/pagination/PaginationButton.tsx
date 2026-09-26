import styles from './pagination.module.css';
import Link from 'next/link';

interface PaginationButtonProps {
  direction: 'next' | 'prev';
  /* Where the button goes; absent on the first/last page, which renders it disabled */
  href?: string;
}

export default function PaginationButton({ direction, href }: PaginationButtonProps) {
  const content = direction === "next" ? (
    <>
      <div>Next</div>
      <ion-icon name={`chevron-forward-outline`}></ion-icon>
    </>
  ) : (
    <>
      <ion-icon name={`chevron-back-outline`}></ion-icon>
      <div>Prev</div>
    </>
  );

  return href ? (
    <Link href={href} className={styles['view-option']} rel={direction}>{content}</Link>
  ) : (
    <span className={styles['view-option']} aria-disabled="true">{content}</span>
  );
}
