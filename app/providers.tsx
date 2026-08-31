"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast/ToastContext";
import { SidebarProvider } from "@/components/layout/sidebar/SidebarContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </SidebarProvider>
    </SessionProvider>
  );
}
