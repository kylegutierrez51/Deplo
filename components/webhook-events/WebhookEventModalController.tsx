"use client";

import { useRouter } from "next/navigation";
import WebhookEventModal from "../modals/WebhookEventModal";
import type { WebhookEvent } from "@/lib/data/webhook-events";

export default function RunModalController({ mode, event }: {
  mode: "view" | "create" | "edit";
  event?: WebhookEvent;
}) {
  const router = useRouter();
  const close = () => router.push('events'); // clear modal query params

  return (
    <WebhookEventModal
      mode={mode}
      {...event}
      onClose={close}
    />
  )
}
