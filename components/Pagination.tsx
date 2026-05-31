"use client"

import defaultStyles from './pagination.module.css'

interface PaginationProps {
  showing: string,
  pages: (number | '...')[],
  currentPage: number,
  styles?: Record<string, string>,
}
export default function Pagination({ showing, pages, currentPage, styles = defaultStyles }: PaginationProps) {
  return (
    <div className={styles['page-view']}>
      <div className={styles.pages}>
        Showing {showing}
      </div>

      <div className={styles['pagination-container']}>
        <div className={styles['pagination-row']}>

          <div className={styles['view-option']}>
            <ion-icon name="chevron-back-outline"></ion-icon>
            <div>Prev</div>
          </div>

          <div className={styles['page-numbers']}>
            {pages.map((page, index) => (
              page === currentPage ?
                <div className={styles['page-number']} key={index}><span>{page}</span></div>
                :
                <div className={styles['page-number']} key={index}>{page}</div>
            ))}
          </div>

          <div className={styles['view-option']}>
            <div>Next</div>
            <ion-icon name="chevron-forward-outline"></ion-icon>
          </div>

        </div>
      </div>
    </div>
  )
}