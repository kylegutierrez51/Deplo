"use client";

import WebhookModal from "./WebhookModal";
import CrudModalController from "../modals/CrudModalController";
import type { Webhook } from "@/lib/data/webhooks";

export default function WebhookModalController({ mode, webhook }: {
  mode: "view" | "create" | "edit";
  webhook?: Webhook;
}) {
  return <CrudModalController mode={mode} record={webhook} basePath={"/webhooks"} ModalComponent={WebhookModal} />;
}
