"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { withParams } from "@/lib/utils/url";
import type { ComponentType } from 'react';

interface ViewModalBaseProps {
  mode: "view" | "create" | "edit";
  onClose: () => void;
}

export default function ViewModalController<T extends object>({ mode, record, basePath, ModalComponent }: {
  mode: "view" | "create" | "edit";
  record?: T;
  basePath: string;
  ModalComponent: ComponentType<T & ViewModalBaseProps>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const close = () => router.push(withParams(basePath, searchParams, { id: null, mode: null })); 

  return (
    <ModalComponent
      mode={mode}
      {...(record as T)}
      onClose={close}
    />
  )
}