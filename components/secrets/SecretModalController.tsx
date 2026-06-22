"use client";

import SecretModal from "./SecretModal";
import CrudModalController from "../modals/CrudModalController";
import type { Secret } from "@/lib/data/secrets";

export default function SecretModalController({ mode, secret }: {
  mode: "view" | "create" | "edit";
  secret?: Secret;
}) {
  return <CrudModalController mode={mode} record={secret} basePath={"/secrets"} ModalComponent={SecretModal} />;
}
