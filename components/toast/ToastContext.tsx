"use client"

import { createContext, useContext, useState, useRef } from 'react';
import { type ToastIcon } from '@/lib/types';

interface ToastItem {
  id: number;
  text: string;
  icon: ToastIcon;
  exiting: boolean;
  sticky: boolean;
}

type ShowToastOptions = { sticky?: boolean };

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (text: string, icon: ToastIcon, options?: ShowToastOptions) => void;
  dismissToast: (id: number) => void;
  dismissStickyToasts: () => void;
}

const TOTAL_DURATION = 3000;
const EXIT_DURATION = 200;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>());

  function remove(id: number) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, EXIT_DURATION);
  }

  function showToast(text: string, icon: ToastIcon, options?: ShowToastOptions) {
    const id = nextId.current++;
    const sticky = options?.sticky ?? false;

    setToasts(prev => [...prev, { id, text, icon, exiting: false, sticky }]);

    if (sticky) return; // sticky toasts never schedules timers

    const exitTimer = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    }, TOTAL_DURATION - EXIT_DURATION);

    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, TOTAL_DURATION);

    timers.current.set(id, [exitTimer, removeTimer]);
  }

  function dismissToast(id: number) {
    timers.current.get(id)?.forEach(clearTimeout);
    remove(id);
  }

  function dismissStickyToasts() {
    toasts.filter(t => t.sticky && !t.exiting).forEach(t => dismissToast(t.id));
  }

  return (
    <ToastContext value={{ toasts, showToast, dismissToast, dismissStickyToasts }}>
      {children}
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
