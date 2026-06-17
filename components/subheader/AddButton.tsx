"use client"

import { useRouter } from "next/navigation";

export default function AddButton({ text, url }: { text: string, url: string }) {
  const router = useRouter();

  return (
    <button onClick={() => router.push(`/${url}?mode=create`)}>
      <ion-icon name="add-outline"></ion-icon>
      {text}
    </button>
  )
}