"use client"

import { createContext, useContext, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { type ToastIcon } from '@/lib/types';

interface ToastItem {
  id: number;
  text: string;
  link?: string;
  icon: ToastIcon;
  exiting: boolean;
  sticky: boolean;
}

type ShowToastOptions = { sticky?: boolean; totalDuration?: number } | undefined;

interface ShowToastProps {
  text: string;
  icon: ToastIcon;
  link?: string;
  options?: ShowToastOptions;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: ({ text, icon, link, options }: ShowToastProps) => void;
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
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

   // A sticky toast reports on work the user started on this page, 
   // so leaving the current page removes it.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setToasts(prev => prev.some(t => t.sticky) ? prev.filter(t => !t.sticky) : prev);
  }

  // Starts the exit animation, then drops the toast once it has played. 
  // Every timer here goes into `timers` so dismissToast can find and cancel it.
  function remove(id: number) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));

    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, EXIT_DURATION);

    timers.current.set(id, [removeTimer]);
  }

  function showToast({ text, icon, link, options }: ShowToastProps) {
    const id = nextId.current++;
    const sticky = options?.sticky ?? false;
    const totalDuration = options?.totalDuration ?? TOTAL_DURATION;

    setToasts(prev => [...prev, { id, text, link, icon, exiting: false, sticky }]);

    if (sticky) return; // sticky toasts never schedules timers

    const exitTimer = setTimeout(() => remove(id), totalDuration - EXIT_DURATION);

    timers.current.set(id, [exitTimer]);
  }

  // used only in sticky toasts when user clicks 'x' 
  function dismissToast(id: number) {
    timers.current.get(id)?.forEach(clearTimeout);
    remove(id);
  }

  // used by HeaderButtons to clear prev sticky toasts when a user runs pipeline
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
