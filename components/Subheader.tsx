"use client"

import { ReactNode } from 'react';
import styles from './subheader.module.css'

interface SubheaderProps {
  title: string,
  subtitle: ReactNode,
  badge?: { count: number; label: string },
  children?: ReactNode,
}
export default function Subheader( {title, subtitle, badge, children }: SubheaderProps) {
  return (
    <div className={styles.subheader}>
      <div className={styles['subheader-inner']}>
        <div className={styles['title-group']}>

          
          {badge ? (
            <div className={styles['title-row']}>
              <h1>{title}</h1>
              <div className={styles["active-badge"]}>
                <span className={styles["active-dot"]}></span>
                <span>{badge.count} {badge.label}</span>
              </div>
            </div>
            ) : 
            <h1>{title}</h1>
          }
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}