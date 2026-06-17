"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PipelineModal from "../modals/PipelineModal";
import type { Pipeline } from "@/lib/data/pipelines";

export default function EnvModalController({ mode, pipeline }: {
  mode: "view" | "create" | "edit";
  pipeline?: Pipeline;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);

  const close = () => router.push('/pipelines'); // clear modal query params

  const edit = () => router.push(`/pipelines?id=${pipeline?.id}&mode=edit`)

  return (
    <PipelineModal
      key={modalKey}
      mode={mode}
      {...pipeline}
      onClose={close}
      onCreate={close}
      onDelete={close}
      onEdit={edit}
      onSave={() => {
        if (mode === 'edit') {
          setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
          router.push(`/pipelines?id=${pipeline?.id}`)
          router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
        } else {
          close();
        }
      }}
    />
  )
}