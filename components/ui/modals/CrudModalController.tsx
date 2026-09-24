"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { withParams } from "@/lib/utils/url";
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
  const searchParams = useSearchParams();
  const [modalKey, setModalKey] = useState(0);
  const { showToast } = useToast();

  // clear the modal's params, keep everything else (the page's filters)
  const onClose = () => router.push(withParams(basePath, searchParams, { id: null, mode: null })); 

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

  const onEdit = () => router.push(withParams(basePath, searchParams, { id: record?.id, mode: 'edit' }));
  const onEditOrDeleteClose = () => router.push(withParams(basePath, searchParams, { id: record?.id, mode: null }));

  const onSave = (message: string) => {
    if (mode === 'edit') {
      startTransition(() => {
        setModalKey(k => k + 1);
        router.push(withParams(basePath, searchParams, { id: record?.id, mode: null }));
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