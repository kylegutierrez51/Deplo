"use client"

import styles from './sidebar.module.css';
import Topbar from './Topbar';
import { useState } from 'react';

interface SidebarShellProps {
  children: React.ReactNode;
  activeItem?: string;
  showToggle?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

export default function SidebarShell({ children, activeItem, showToggle = true, open, onToggle }: SidebarShellProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleToggle = isControlled ? onToggle : () => setInternalOpen(o => !o);

  return (
    <>
      <aside className={`${styles.sidebar} ${isOpen ? 'sidebar-open' : `${styles.closed} sidebar-closed`}`}>
        {children}
      </aside>

      <Topbar activeItem={activeItem} showToggle={showToggle} handleToggle={handleToggle} />
    </>
  )
}
