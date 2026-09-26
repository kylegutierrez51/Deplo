"use client"

import styles from './pagination.module.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PageJumpProps {
  page: number;
  pageCount: number;
  hrefFor: (target: number) => string;
}

/*
=======================================================================================
  An ellipsis that turns into an input when clicked, for reaching a page the range does not list.

  Enter navigates; Escape or clicking away puts the ellipsis back without navigating. A number past the
  end goes to the last page, the same clamp the server applies to a hand-edited `?page=`.
=======================================================================================
 */
export default function PageJump({ page, pageCount, hrefFor }: PageJumpProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const close = () => {
    setEditing(false);
    setValue('');
  };

  const submit = () => {
    const target = Math.min(Number(value), pageCount);
    close();
    if (target >= 1 && target !== page) router.push(hrefFor(target));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') close();
  };

  if (!editing) {
    return (
      <button type="button" className={styles['page-jump']} onClick={() => setEditing(true)} aria-label="Jump to page">
        ...
      </button>
    );
  }

  return (
    <input
      className={styles['page-jump-input']}
      type="text"
      inputMode="numeric"
      autoFocus
      aria-label={`Go to page (1-${pageCount})`}
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
      onKeyDown={handleKeyDown}
      onBlur={close}
    />
  );
}
