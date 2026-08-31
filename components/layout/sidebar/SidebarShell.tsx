"use client"

import styles from './sidebar.module.css';
import { useSidebar } from './SidebarContext';
import Topbar from './Topbar';

interface SidebarShellProps {
  children: React.ReactNode;
  activeItem?: string;
  showToggle?: boolean; // used by pipeline editor
}

export default function SidebarShell({ children, activeItem, showToggle = true }: SidebarShellProps) {
  const { open } = useSidebar();

  return (
    <>
      <aside className={`${styles.sidebar} ${open ? 'sidebar-open' : `${styles.closed} sidebar-closed`}`}>
        {children}
      </aside>

      <Topbar activeItem={activeItem} showToggle={showToggle} />
    </>
  )
}
