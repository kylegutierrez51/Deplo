"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EnvironmentModal from "../modals/EnvironmentModal";
import type { Environment } from "@/lib/data/environments";

export default function EnvModalController({ mode, env }: {
  mode: "view" | "create" | "edit";
  env?: Environment;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);

  const close = () => router.push('/environments'); // clear modal query params

  const edit = () => router.push(`/environments?id=${env?.id}&mode=edit`)

  return (
    <EnvironmentModal
      key={modalKey}
      mode={mode}
      {...env}
      onClose={close}
      onCreate={close}
      onDelete={close}
      onEdit={edit}
      onSave={() => {
        if (mode === 'edit') {
          setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
          router.push(`/environments?id=${env?.id}`)
          router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
        } else {
          close();
        }
      }}
    />
  )
}
