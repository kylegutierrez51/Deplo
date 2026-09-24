"use client"

import { useRouter, useSearchParams } from "next/navigation";
import { withParams } from "@/lib/utils/url";

export default function AddButton({ text, url }: { text: string, url: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <button onClick={() => router.push(withParams(`/${url}`, searchParams, { id: null, mode: 'create' }))}>
      <ion-icon name="add-outline"></ion-icon>
      {text}
    </button>
  )
}