"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import WebhookModal from "../modals/WebhookModal";
import type { Webhook } from "@/lib/data/webhooks";

export default function WebhookModalController({ mode, webhook }: {
  mode: "view" | "create" | "edit";
  webhook?: Webhook;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);

  const close = () => router.push('/webhooks'); // clear modal query params

  const edit = () => router.push(`/webhooks?id=${webhook?.id}&mode=edit`)

  return (
    <WebhookModal
      key={modalKey}
      mode={mode}
      {...webhook}
      onClose={close}
      onCreate={close}
      onDelete={close}
      onEdit={edit}
      onSave={() => {
        if (mode === 'edit') {
          setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
          router.push(`/webhooks?id=${webhook?.id}`)
          router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
        } else {
          close();
        }
      }}
    />
  )
}
