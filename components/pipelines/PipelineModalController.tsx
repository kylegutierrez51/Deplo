"use client";

import PipelineModal from "./PipelineModal";
import CrudModalController from "../modals/CrudModalController";
import type { Pipeline } from "@/lib/data/pipelines";

export default function PipelineModalControler({ mode, pipeline }: {
  mode: "view" | "create" | "edit";
  pipeline?: Pipeline;
}) {
  return <CrudModalController mode={mode} record={pipeline} basePath={"/pipelines"} recordLabel={"Pipeline"} ModalComponent={PipelineModal} />;
}