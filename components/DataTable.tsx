"use client"

import { ReactNode } from 'react';
import styles from './data-table.module.css'

interface DataTableProps {
  columns: string[];
  children?: ReactNode,
}
export default function DataTable({ columns, children }: DataTableProps) {
  return (
    <div className={styles['table-border']}>
      <table>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  )
}