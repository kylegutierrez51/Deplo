"use client";

import { useRouter } from "next/navigation";
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
  const close = () => router.push(basePath);

  return (
    <ModalComponent
      mode={mode}
      {...(record as T)}
      onClose={close}
    />
  )
}