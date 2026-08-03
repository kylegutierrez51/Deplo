import defaultStyles from './pagination.module.css'
import PaginationButton from './PaginationButton';

interface PaginationProps {
  showing: string,
  totalRows: number,
  pages: (number | '...')[],
  currentPage: number,
  styles?: Record<string, string>,
}
export default function Pagination({ showing, totalRows, pages, currentPage, styles = defaultStyles }: PaginationProps) {
  return (
    <div className={styles['page-view']}>
      <div className={styles.pages}>
        Showing {showing} of {totalRows}
      </div>

      <div className={styles['pagination-container']}>
        <div className={styles['pagination-row']}>

          <PaginationButton direction='prev' page={currentPage - 1}/>

          <div className={styles['page-numbers']}>
            {pages.map((page, index) => (
              page === currentPage ?
                <div className={styles['page-number']} key={index}><span>{page}</span></div>
                : <div className={styles['page-number']} key={index}>{page}</div>
            ))}
          </div>
          <PaginationButton direction='next' page={currentPage + 1} />
        </div>
      </div>
    </div>
  )
}