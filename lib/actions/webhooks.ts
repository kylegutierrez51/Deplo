"use server"

import { encryptSecret, generateWebhookSecret } from '../crypto';
import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';

export type RegenerateSecretState = FormState & { secret?: string };

export async function addWebhook(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const pipelineId = formData.get('pipeline_id') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];
  const events = formData.getAll('events') as string[];
  const secret = formData.get('webhook_secret') as string;

  const { encryptedValue, iv, authTag } = encryptSecret(secret);

  try {
    await prisma.webhook.create({
      data: { pipelineId, branchFilters, events, encryptedValue, iv, authTag, createdById },
    });

    revalidatePath('/webhooks');

    return {
      status: 'success',
      message: 'Webhook added'
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
      return { status: 'error', message: 'Selected pipeline no longer exists.' };
    }
    return {
      status: 'error',
      message: 'Error adding webhook. Please try again.',
    };
  }
}

export async function updateWebhook(prevState: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get('id') as string;
  const pipelineId = formData.get('pipeline_id') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];
  const events = formData.getAll('events') as string[];

  try {
    await prisma.webhook.update({
      where: { id },
      data: { pipelineId, branchFilters, events },
    });

    revalidatePath('/webhooks');

    return {
      status: 'success',
      message: 'Webhook updated'
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
      return { status: 'error', message: 'Selected pipeline no longer exists.' };
    }
    return {
      status: 'error',
      message: 'Error updating webhook. Please try again.',
    };
  }
}

export async function deleteWebhook(id: string): Promise<FormState> {
  try {
    const deletedWebhook = await prisma.webhook.delete({
      where: { id }
    });

    revalidatePath('/webhooks');

    return {
      status: 'success',
      message: `Webhook ${deletedWebhook.id} deleted`
    }

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}:` + 'Error deleting webhook');
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting webhook. Please try again.'
    }
  }
}

// Rotates the signing secret only — decoupled from updateWebhook so that
// editing metadata (pipeline, branch filters, events) never silently
// re-signs or discards a rotation, and vice versa.
export async function regenerateWebhookSecret(id: string): Promise<RegenerateSecretState> {
  const secret = generateWebhookSecret();
  const { encryptedValue, iv, authTag } = encryptSecret(secret);

  try {
    await prisma.webhook.update({
      where: { id },
      data: { encryptedValue, iv, authTag },
    });

    revalidatePath('/webhooks');

    return {
      status: 'success',
      message: 'Webhook secret regenerated',
      secret,
    };

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      return { status: 'error', message: 'Webhook no longer exists.' };
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error regenerating secret. Please try again.'
    }
  }
}
