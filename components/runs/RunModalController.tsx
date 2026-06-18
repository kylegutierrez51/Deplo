"use client";

import { useRouter } from "next/navigation";
import RunModal from "../modals/RunModal";
import type { Run } from "@/lib/data/runs";

export default function RunModalController({ mode, run }: {
  mode: "view" | "create" | "edit";
  run?: Run;
}) {
  const router = useRouter();
  const close = () => router.push('/runs'); // clear modal query params

  return (
    <RunModal
      mode={mode}
      {...run}
      onClose={close}
    />
  )
}
