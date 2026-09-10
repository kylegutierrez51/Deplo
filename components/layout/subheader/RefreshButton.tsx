"use client"

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

// makes the click look like it does something
const FEEDBACK_MS = 400;

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, FEEDBACK_MS));
    });
  };

  return (
    <button onClick={refresh} disabled={isPending} aria-busy={isPending}>
      <ion-icon name="refresh-outline"></ion-icon>
      {isPending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}
