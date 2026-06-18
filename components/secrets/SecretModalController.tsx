"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SecretModal from "../modals/SecretModal";
import type { Secret } from "@/lib/data/secrets";

export default function SecretModalController({ mode, secret }: {
  mode: "view" | "create" | "edit";
  secret?: Secret;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);

  const close = () => router.push('/secrets'); // clear modal query params

  const edit = () => router.push(`/secrets?id=${secret?.id}&mode=edit`);
  const editClose = () => router.push(`/secrets?id=${secret?.id}`);

  return (
    <SecretModal
      key={modalKey}
      mode={mode}
      {...secret}
      onClose={close}
      onCreate={close}
      onDelete={close}
      onEdit={edit}
      onEditClose={editClose}
      onSave={() => {
        if (mode === 'edit') {
          setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
          router.push(`/secrets?id=${secret?.id}`)
          router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
        } else {
          close();
        }
      }}
    />
  )
}
