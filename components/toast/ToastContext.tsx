"use client"

import { createContext, useContext, useState, useRef } from 'react';

export type ToastIcon = 'checkmark-circle-outline' | 'create-outline' | 'trash-outline';

interface ToastState {
  text: string;
  icon: ToastIcon;
}

interface ToastContextValue {
  toast: ToastState | null;
  showToast: (text: string, icon: ToastIcon) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(text: string, icon: ToastIcon) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ text, icon });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }

  return (
    <ToastContext value={{ toast, showToast }}>
      {children}
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
