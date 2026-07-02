"use client"

import { createContext, useContext, useState, useRef } from 'react';
import { type ToastIcon } from '@/lib/types';

interface ToastItem {
  id: number;
  text: string;
  icon: ToastIcon;
  exiting: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (text: string, icon: ToastIcon) => void;
}

const TOTAL_DURATION = 3000;
const EXIT_DURATION = 200;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>());

  function showToast(text: string, icon: ToastIcon) {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, text, icon, exiting: false }]);

    const exitTimer = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    }, TOTAL_DURATION - EXIT_DURATION);

    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, TOTAL_DURATION);

    timers.current.set(id, [exitTimer, removeTimer]);
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
