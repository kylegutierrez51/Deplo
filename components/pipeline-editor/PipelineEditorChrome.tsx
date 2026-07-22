"use client"

import { cloneElement, createContext, isValidElement, useContext, useState, type ReactNode } from "react";

type ChromeValue = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  stageSidebarOpen: boolean;
  openStageSidebar: () => void;
  closeStageSidebar: () => void;
}

const ChromeContext = createContext<ChromeValue | null>(null);

function useChrome() {
  const context = useContext(ChromeContext);
  if (!context) throw new Error("Chrome parts must render inside <PipelineEditorChrome>");
  return context;
}

export function PipelineEditorChrome({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stageSidebarOpen, setStageSidebarOpen] = useState(false);

  return (
    <ChromeContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar: () => setSidebarOpen(o => !o),
        stageSidebarOpen,
        openStageSidebar: () => setStageSidebarOpen(true),
        closeStageSidebar: () => setStageSidebarOpen(false),
      }}>
      {children}
    </ChromeContext.Provider>
  )
}

type SidebarProps = {
  open?: boolean;
  onToggle?: () => void;
};

export function SidebarSlot({ children }: { children: ReactNode }) {
  const { sidebarOpen, toggleSidebar } = useChrome();
  if (!isValidElement<SidebarProps>(children)) return null;
  return cloneElement(children, { open: sidebarOpen, onToggle: toggleSidebar });
}

export function MainSidebarToggle({ className, children }: { className?: string; children?: ReactNode }) {
  const { toggleSidebar } = useChrome();
  return (
    <button type="button" className={className} onClick={toggleSidebar} aria-label="Toggle sidebar">
      {children}
    </button>
  )
}

// used in Stage.tsx, wrapped around each node
export function StageSidebarToggle({ children }: { className?: string; children?: ReactNode }) {
  const { openStageSidebar } = useChrome();
  return (
    <div onClick={openStageSidebar}>
      {children}
    </div>
  )
}