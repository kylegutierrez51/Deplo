"use client";

import styles from "@/app/webhooks/webhooks.module.css"
import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';

export default function WebhookCardShell({ children, id }: { children: React.ReactNode; id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const open = () => router.push(withParams('/webhooks', searchParams, { id, mode: null })); 
  
  return (
    <div className={styles['webhook-card-wrapper']} onClick={open}>
      {children}
    </div>
  );
}