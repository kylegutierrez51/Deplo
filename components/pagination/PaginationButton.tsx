"use client"

import styles from './pagination.module.css'
import { capitalize } from '@/lib/utils/string'
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface PaginationButtonProps {
  direction: 'next' | 'prev';
  page: number;
  disabled?: boolean;
}

export default function PaginationButton({ direction, page, disabled }: PaginationButtonProps) {
  const router = useRouter();
  const pathName = usePathname();
  const searchParams = useSearchParams();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    router.push(`${pathName}?${params.toString()}`)
  }

  return (
    <button type="button" className={styles['view-option']} onClick={handleClick} disabled={disabled}>
      {direction === "next" ? (
        <>
          <div>Next</div>
          <ion-icon name={`chevron-forward-outline`}></ion-icon>
        </>
      ) : (
        <>
          <ion-icon name={`chevron-back-outline`}></ion-icon>
          <div>Prev</div>

        </>
      )}
    </button>
  )
}