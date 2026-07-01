"use client";

import { useRouter } from "next/navigation";
import { useState, } from "react";
import type { ComponentType } from 'react';
import { useToast } from '@/components/toast/ToastContext';

interface CrudModalBaseProps {
  mode: "view" | "create" | "edit";
  onClose: () => void;
  onCreate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditOrDeleteClose: () => void;
  onSave: () => void;
}

export default function CrudModalController<T extends { id: string }>({ mode, record, basePath, recordLabel, ModalComponent }: {
  mode: "view" | "create" | "edit";
  record?: T;
  basePath: string;
  recordLabel: string;
  ModalComponent: ComponentType<T & CrudModalBaseProps>;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);
  const toast = useToast();

  const onClose = () => router.push(basePath); // clear modal query params

  const onCreate = () => {
    toast.showToast("Created " + recordLabel, 'checkmark-circle-outline');
    onClose();
  }

  const onDelete = () => {
    toast.showToast("Deleted " + recordLabel, 'trash-outline');
    onClose();
  }

  const onEdit = () => router.push(`${basePath}?id=${record?.id}&mode=edit`);
  const onEditOrDeleteClose = () => router.push(`${basePath}?id=${record?.id}`);

  const onSave = () => {
    if (mode === 'edit') {
      setModalKey(k => k + 1); // remounts component, resets edit mode back to view mode
      router.push(`${basePath}?id=${record?.id}`);
      router.refresh();  // reruns server component (app/secrets/page.tsx) so the table reflects the edit
      toast.showToast("Edited " + recordLabel, 'create-outline');
    } else {
      onClose();
    }
  }

  return (
    <ModalComponent
      key={modalKey}
      mode={mode}
      {...(record as T)}
      onClose={onClose}
      onCreate={onCreate}
      onDelete={onDelete}
      onEdit={onEdit}
      onEditOrDeleteClose={onEditOrDeleteClose}
      onSave={onSave}
    />
  )
}