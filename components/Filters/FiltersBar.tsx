import { ReactNode } from 'react';
import styles from './filters-bar.module.css'

export default function FiltersBar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.filters}>
      <div className={styles['filters-bar']}>
        {children}
      </div>
    </div>
  )
}