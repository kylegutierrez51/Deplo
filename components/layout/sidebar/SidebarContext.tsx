"use client"

import { createContext, useContext, useState } from 'react';

type SidebarContextValue = {
  open: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean>(false);

  function onToggle() {
    setOpen(o => !o);
  }


  return (
    <SidebarContext value={{ open, toggle: onToggle }}>
      {children}
    </SidebarContext>
 )
}

// used by pipeline editor
export function MainSidebarToggle({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { toggle } = useSidebar();
  return (
    <button type="button" className={className} onClick={toggle} aria-label="Toggle sidebar">
      {children}
    </button>
  )
}


export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}