"use client";

import PipelineModal from "./PipelineModal";
import CrudModalController from "@/components/ui/modals/CrudModalController";
import type { Pipeline } from "@/lib/data/pipelines";
import type { Environment } from "@/lib/data/environments";

export default function PipelineModalControler({ mode, pipeline, environments }: {
  mode: "view" | "create" | "edit";
  pipeline?: Pipeline;
  environments: Environment[];
}) {
  return (
    <CrudModalController<Pipeline, { environments: Environment[] }>
      mode={mode}
      record={pipeline}
      basePath={"/pipelines"}
      ModalComponent={PipelineModal}
      extraProps={{ environments }}
    />
  )
}
