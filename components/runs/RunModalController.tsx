"use client";

import RunModal from "./RunModal";
import ViewModalController from "../modals/ViewModalController";
import type { Run } from "@/lib/data/runs";

export default function RunModalController({ mode, run }: {
  mode: "view" | "create" | "edit";
  run?: Run;
}) {
  return <ViewModalController mode={mode} record={run} basePath={"/runs"} ModalComponent={RunModal} />;
}
