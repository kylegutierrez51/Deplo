"use client"

import { createContext, useContext, useState, useRef } from 'react';

export type ToastIcon = 'checkmark-circle-outline' | 'create-outline' | 'trash-outline';

interface ToastItem {
  id: number;
  text: string;
  icon: ToastIcon;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (text: string, icon: ToastIcon) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  function showToast(text: string, icon: ToastIcon) {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, text, icon }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, 3000);
    timers.current.set(id, timer);
  }

  return (
    <ToastContext value={{ toasts, showToast }}>
      {children}
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
