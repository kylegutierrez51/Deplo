"use client";

import { useRouter } from "next/navigation";
import { useState, } from "react";
import type { ComponentType } from 'react';

interface CrudModalBaseProps {
  mode: "view" | "create" | "edit";
  onClose: () => void;
  onCreate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditClose: () => void;
  onSave: () => void;
}

export default function CrudModalController<T extends object>({ mode, record, basePath, ModalComponent }: {
  mode: "view" | "create" | "edit";
  record?: any;
  basePath: string;
  ModalComponent: ComponentType<T & CrudModalBaseProps>;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);

  const close = () => router.push(basePath); // clear modal query params

  const edit = () => router.push(`${basePath}?id=${record?.id}&mode=edit`);
  const editClose = () => router.push(`${basePath}?id=${record?.id}`);

  const save = () => {
    if (mode === 'edit') {
      setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
      router.push(`${basePath}?id=${record?.id}`)
      router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
    } else {
      close();
    }
  }

  return (
    <ModalComponent
      key={modalKey}
      mode={mode}
      {...(record as T)}
      onClose={close}
      onCreate={close}
      onDelete={close}
      onEdit={edit}
      onEditClose={editClose}
      onSave={save}
    />
  )
}