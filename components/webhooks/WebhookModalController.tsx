"use client";

import WebhookModal from "./WebhookModal";
import CrudModalController from "@/components/ui/modals/CrudModalController";
import type { Webhook } from "@/lib/data/webhooks";
import type { Pipeline } from "@/lib/data/pipelines";

export default function WebhookModalController({ mode, webhook, pipelines }: {
  mode: "view" | "create" | "edit";
  webhook?: Webhook;
  pipelines: Pipeline[] | null;
}) {
  return (
    <CrudModalController
      mode={mode}
      record={webhook}
      basePath={"/webhooks"}
      recordLabel={"Webhook"}
      ModalComponent={WebhookModal}
      extraProps={{ pipelines }}
    />
  );
}
