"use client"

import { createContext, useContext, useState, type ReactNode } from "react";

type ChromeValue = {
  stageSidebarOpen: boolean;
  openStageSidebar: () => void;
  closeStageSidebar: () => void;
}

const ChromeContext = createContext<ChromeValue | null>(null);

function useChrome() {
  const context = useContext(ChromeContext);
  if (!context) throw new Error("Chrome parts must render inside PipelineEditorChrome");
  return context;
}

export function PipelineEditorChrome({ children }: { children: ReactNode }) {
  const [stageSidebarOpen, setStageSidebarOpen] = useState(false);

  return (
    <ChromeContext
      value={{
        stageSidebarOpen,
        openStageSidebar: () => setStageSidebarOpen(true),
        closeStageSidebar: () => setStageSidebarOpen(false),
      }}>
      {children}
    </ChromeContext>
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