"use client";

import SecretModal from "./SecretModal";
import CrudModalController from "@/components/ui/modals/CrudModalController";
import type { SecretDetail } from "@/lib/data/secrets";
import type { Environment } from "@/lib/data/environments";

export default function SecretModalController({ mode, secret, environments }: {
  mode: "view" | "create" | "edit";
  secret?: SecretDetail;
  environments: Environment[] | null
}) {
  // `key` is a reserved React prop name — spreading it onto ModalComponent would
  // get swallowed as the reconciliation key instead of reaching SecretModal's props.
  // SecretModal also expects the environment name/type flattened rather than nested.
  let record: (Omit<SecretDetail, "key" | "environment"> & { secretKey: string; environmentName: string; environmentType: SecretDetail["environment"]["type"] }) | undefined;

  if (secret) {
    const { key, environment, ...rest } = secret;
    record = { ...rest, secretKey: key, environmentName: environment.name, environmentType: environment.type };
  }

  return (
    <CrudModalController
      mode={mode}
      record={record}
      basePath={"/secrets"}
      recordLabel={"Secret"}
      ModalComponent={SecretModal}
      extraProps={{ environments }}
    />
  );
}
