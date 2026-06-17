"use client"

import { useRouter } from "next/navigation";

export default function AddSecretButton() {
  const router = useRouter();

  return (
    <button onClick={() => router.push("/secrets?create=1")}>
      <ion-icon name="add-outline"></ion-icon>
      Add Secret
    </button>
  )
}