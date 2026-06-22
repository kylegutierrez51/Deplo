"use client";

import AuditModal from "./AuditModal";
import ViewModalController from "../modals/ViewModalController";
import type { Audit } from "@/lib/data/audits";

export default function AuditModalController({ mode, audit }: {
  mode: "view" | "create" | "edit";
  audit?: Audit;
}) {
  return <ViewModalController mode={mode} record={audit} basePath={"/audits"} ModalComponent={AuditModal} />;
}
