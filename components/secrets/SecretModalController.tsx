"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SecretModal from "../modals/SecretModal";
import type { Secret } from "@/lib/data/secrets";

export default function SecretModalController({ mode, secret }: {
  mode: "view" | "create";
  secret?: Secret;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);

  const close = () => router.push('/secrets'); // clear modal query params

  return (
    <SecretModal
      key={modalKey}
      initialMode={mode}
      {...secret}
      onClose={close}
      onDelete={close}
      onSave={() => {
        if (mode === 'view') {
          setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
          router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
        } else {
          close();
        }
      }}
    />
  )
}
