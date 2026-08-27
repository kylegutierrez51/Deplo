"use server"

import { encryptSecret, generateWebhookSecret } from '@/lib/utils/crypto';
import { FormState, EventType } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { EventType as PrismaEventType, Prisma } from '@/generated/prisma/client';
import { auth } from '@/auth';

const EVENT_TYPE_MAP: Record<EventType, PrismaEventType> = {
  push: 'PUSH',
  'pull-request': 'PULL_REQUEST',
};

function validateAndMapEvents(formData: FormData): PrismaEventType[] | null {
  const events = formData.getAll('events') as string[];

  const validatedEvents: PrismaEventType[] = []
  for (const e of events) {
    if (!['push', 'pull-request'].includes(e)) return null;
    validatedEvents.push(EVENT_TYPE_MAP[e as EventType])
  }
  return validatedEvents;
}


export type RegenerateSecretState = FormState & { secret?: string };

export async function addWebhook(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  if (!createdById) return {
    status: 'error',
    message: 'Sign in to add a webhook.'
  }

  const pipelineId = formData.get('pipeline_id') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];
  const secret = formData.get('webhook_secret') as string;
  const events = validateAndMapEvents(formData); 

  if (!events) {
    return {
      status: 'error',
      message: 'Error adding trigger event data. Please try again.'
    }
  }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'Selected pipeline no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error adding webhook. Please try again.',
    };
  }
}

export async function updateWebhook(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to update a webhook.'
  }

  const id = formData.get('id') as string;
  const pipelineId = formData.get('pipeline_id') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];
  const events = validateAndMapEvents(formData); 

  if (!events) {
    return {
      status: 'error',
      message: 'Error adding trigger event data. Please try again.'
    }
  }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(`${error.code}: ${error.message}`);

      if (error.code === 'P2003') return {
        status: 'error',
        message: 'Selected pipeline no longer exists.'
      }

      if (error.code === 'P2025') return {
        status: 'error',
        message: 'This webhook no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error updating webhook. Please try again.',
    };
  }
}

export async function deleteWebhook(id: string): Promise<FormState> {
  const session = await auth();

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to delete a webhook.'
  }

  try {
    await prisma.webhook.delete({
      where: { id }
    });

    revalidatePath('/webhooks');

    return {
      status: 'success',
      message: `Webhook deleted`
    }

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This webhook no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting webhook. Please try again.'
    }
  }
}


export async function regenerateWebhookSecret(id: string): Promise<RegenerateSecretState> {
  const session = await auth();

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to regenerate a webhook secret.'
  }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This webhook no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error regenerating webhook. Please try again.'
    }
  }
}
