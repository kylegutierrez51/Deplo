"use client";

import SecretModal from "./SecretModal";
import CrudModalController from "../modals/CrudModalController";
import type { Secret } from "@/lib/data/secrets";

export default function SecretModalController({ mode, secret }: {
  mode: "view" | "create" | "edit";
  secret?: Secret;
}) {
  // `key` is a reserved React prop name — spreading it onto ModalComponent would
  // get swallowed as the reconciliation key instead of reaching SecretModal's props.
  let record: (Omit<Secret, "key"> & { secretKey: string }) | undefined;
  
  if (secret) {
    const { key, ...rest } = secret;
    record = { ...rest, secretKey: key };
  }

  return <CrudModalController mode={mode} record={record} basePath={"/secrets"} recordLabel={"Secret"} ModalComponent={SecretModal} />;
}
