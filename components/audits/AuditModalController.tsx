"use client";

import { useRouter } from "next/navigation";
import AuditModal from "../modals/AuditModal";
import type { Audit } from "@/lib/data/audits";

export default function EnvModalController({ mode, audit }: {
  mode: "view" | "create" | "edit";
  audit?: Audit;
}) {
  const router = useRouter();
  const close = () => router.push('/audits'); // clear modal query params

  return (
    <AuditModal
      mode={mode}
      {...audit}
      onClose={close}
    />
  )
}
