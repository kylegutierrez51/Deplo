"use client";

import styles from "@/app/webhooks/webhooks.module.css"
import { useRouter } from 'next/navigation';

export default function WebhookCardShell({ children, id }: { children: React.ReactNode; id: number }) {
  const router = useRouter();
  const open = () => router.push(`/webhooks?id=${id}`);
  
  return (
    <div className={styles['webhook-card-wrapper']} onClick={open}>
      {children}
    </div>
  );
}
