"use client";

import WebhookEventModal from "./WebhookEventModal";
import ViewModalController from "../modals/ViewModalController";
import type { WebhookEvent } from "@/lib/data/webhook-events";

export default function WebhookEventModalController({ mode, event }: {
  mode: "view" | "create" | "edit";
  event?: WebhookEvent;
}) {
  return <ViewModalController mode={mode} record={event} basePath={"/webhooks/events"} ModalComponent={WebhookEventModal} />;
}
