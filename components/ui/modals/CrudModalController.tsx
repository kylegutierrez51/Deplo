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

export default function CrudModalController<T extends { id: string }, Extra extends object = Record<string, never>>({ mode, record, basePath, ModalComponent, extraProps }: {
  mode: "view" | "create" | "edit";
  record?: T;
  basePath: string;
  ModalComponent: ComponentType<T & Extra & CrudModalBaseProps>;
  extraProps?: Extra;
}) {
  const router = useRouter();
  const [modalKey, setModalKey] = useState(0);
  const { showToast } = useToast();

  const onClose = () => router.push(basePath); // clear modal query params

  const onCreate = (message: string) => {
    showToast({
      text: message,
      icon: 'checkmark-circle-outline'
    });

    onClose();
  }

  const onError = (message: string) => {
    showToast({
      text: message,
      icon: 'close-circle-outline'
    });
  }

  const onDelete = (message: string) => {
    showToast({
      text: message,
      icon: 'trash-outline'
    });

    onClose();
  }

  const onEdit = () => router.push(`${basePath}?id=${record?.id}&mode=edit`);
  const onEditOrDeleteClose = () => router.push(`${basePath}?id=${record?.id}`);

  const onSave = (message: string) => {
    if (mode === 'edit') {
      startTransition(() => {
        setModalKey(k => k + 1);
        router.push(`${basePath}?id=${record?.id}`);
      });
      router.refresh();  // reruns page server component so the table reflects the edit
      showToast({
        text: message,
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