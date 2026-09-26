"use client"

import styles from './pagination.module.css'
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import PaginationButton from './PaginationButton';
import PageJump from './PageJump';
import { pageRange } from '@/lib/utils/pagination';
import { withParams } from '@/lib/utils/url';

interface PaginationProps {
  page: number,
  pageCount: number,
  total: number,
  pageSize: number
}

/*
=======================================================================================
  Every page is a link that keeps the URL's filters and swaps only `?page=`, so the server component re-reads the window.

  Page 1 drops the param rather than writing `page=1`, the same rule QueryFilterListbox follows for default values.
  `id` and `mode` are dropped too: moving to another page should not carry an open modal along with it.
=======================================================================================
 */
export default function Pagination({ page, pageCount, total, pageSize }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (target: number) =>
    withParams(pathname, searchParams, { id: null, mode: null, page: target === 1 ? null : String(target) }); // does not show `page?=1` in URL

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className={styles['page-view']}>
      <div className={styles.pages}>
        Showing {first}-{last} of {total}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Pagination" className={styles['pagination-container']}>
          <div className={styles['pagination-row']}>

            <PaginationButton direction='prev' href={page > 1 ? hrefFor(page - 1) : undefined} />

            <div className={styles['page-numbers']}>
              {pageRange(page, pageCount).map((item, index) => (
                <div className={styles['page-number']} key={`${item}-${index}`}>
                  {item === '...' ? <PageJump page={page} pageCount={pageCount} hrefFor={hrefFor} />
                    : item === page ? <span aria-current="page">{item}</span>
                      : <Link href={hrefFor(item)} aria-label={`Page ${item}`}>{item}</Link>}
                </div>
              ))}
            </div>

            <PaginationButton direction='next' href={page < pageCount ? hrefFor(page + 1) : undefined} />
          </div>
        </nav>
      )}
    </div>
  )
}
