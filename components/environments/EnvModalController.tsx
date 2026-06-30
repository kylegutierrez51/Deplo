"use client";

import EnvironmentModal from "./EnvironmentModal";
import CrudModalController from "../modals/CrudModalController";
import type { Environment } from "@/lib/data/environments";

export default function EnvModalController({ mode, env }: {
  mode: "view" | "create" | "edit";
  env?: Environment;
}) {
  return <CrudModalController<Environment> mode={mode} record={env} basePath={"/environments"} recordLabel={"Environment"} ModalComponent={EnvironmentModal} />;
}
