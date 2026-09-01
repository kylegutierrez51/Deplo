"use client";

import { useRouter } from "next/navigation";
import { useState, startTransition } from "react";
import type { ComponentType } from 'react';
import { useToast } from '@/components/ui/toast/ToastContext';

interface CrudModalBaseProps {
  mode: "view" | "create" | "edit";
  onClose: () => void;
  onCreate: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onEditOrDeleteClose: () => void;
  onSave: () => void;
  onError: (message: string) => void;
}

export default function CrudModalController<T extends { id: string }, Extra extends object = Record<string, never>>({ mode, record, basePath, recordLabel, ModalComponent, extraProps }: {
  mode: "view" | "create" | "edit";
  record?: T;
  basePath: string;
  recordLabel: string;
  ModalComponent: ComponentType<T & Extra & CrudModalBaseProps>;
  extraProps?: Extra;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);
  const toast = useToast();

  const onClose = () => router.push(basePath); // clear modal query params

  const onCreate = () => {
    toast.showToast({
      text: "Created " + recordLabel,
      icon: 'checkmark-circle-outline'
    });

    onClose();
  }

  const onError = (message: string) => {
    toast.showToast({
      text: message,
      icon: 'close-circle-outline'
    });
  }

  const onDelete = () => {
    toast.showToast({
      text: "Deleted " + recordLabel,
      icon: 'trash-outline'
    });

    onClose();
  }

  const onEdit = () => router.push(`${basePath}?id=${record?.id}&mode=edit`);
  const onEditOrDeleteClose = () => router.push(`${basePath}?id=${record?.id}`);

  const onSave = () => {
    if (mode === 'edit') {
      startTransition(() => {
        setModalKey(k => k + 1);
        router.push(`${basePath}?id=${record?.id}`);
      });
      router.refresh();  // reruns page server component so the table reflects the edit
      toast.showToast({
        text: "Edited " + recordLabel,
        icon: 'create-outline'
      });
    } else {
      onClose();
    }
  }

  const props = {
    mode,
    ...(record as T),
    ...(extraProps as Extra),
    onClose,
    onCreate,
    onDelete,
    onEdit,
    onEditOrDeleteClose,
    onSave,
    onError,
  } as T & Extra & CrudModalBaseProps;

  return <ModalComponent key={modalKey} {...props} />;
}