"use server"

import { encryptSecret, generateWebhookSecret } from '@/lib/utils/crypto';
import { FormState, EventType } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from '@/generated/prisma/client';
import { EventType as PrismaEventType, AuditAction, ResourceType } from '@/generated/prisma';
import { auth } from '@/auth';
import { addAudit } from './audits';

const EVENT_TYPE_MAP: Record<EventType, PrismaEventType> = {
  push: 'PUSH',
  'pull-request': 'PULL_REQUEST',
  ping: 'PING',
  unrecognized: 'UNRECOGNIZED'
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


// The environment is optional, so an empty id means "none". Text that resolved to no
// environment is refused instead, or a typo would silently save the webhook without one.
function readEnvironmentId(formData: FormData): { environmentId: string | null } | null {
  const environmentId = (formData.get('environment_id') as string | null) || null;
  const typed = (formData.get('environment_name') as string | null)?.trim();
  if (!environmentId && typed) return null;
  return { environmentId };
}

const fkMessage = (environmentId: string | null) =>
  environmentId ? 'Selected pipeline or environment no longer exists.' : 'Selected pipeline no longer exists.';


export type RegenerateSecretState = FormState & { secret?: string };

export async function addWebhook(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const user = session?.user;
  const createdById = user?.id ?? null;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to add a webhook.'
  }

  const userId = user.id;

  const pipelineId = formData.get('pipeline_id') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];
  const secret = formData.get('webhook_secret') as string;
  const events = validateAndMapEvents(formData);
  const environment = readEnvironmentId(formData);

  if (!pipelineId) return {
    status: 'error',
    message: 'Select a pipeline from the list.'
  }

  if (!environment) return {
    status: 'error',
    message: 'Select an environment from the list, or leave it empty.'
  }

  const { environmentId } = environment;

  if (!events) {
    return {
      status: 'error',
      message: 'Error adding trigger event data. Please try again.'
    }
  }

  const { encryptedValue, iv, authTag } = encryptSecret(secret);

  try {
    await prisma.$transaction(async (tx) => {
      const webhook = await tx.webhook.create({
        data: { pipelineId, environmentId, branchFilters, events, encryptedValue, iv, authTag, createdById },
        select: { id: true, pipeline: { select: { name: true } } }
      });

      await addAudit({
        userId: userId,
        actor: user.name ?? null,
        action: AuditAction.WEBHOOK_CREATED,
        resourceType: ResourceType.WEBHOOK,
        resourceId: webhook.id,
        resourceLabel: webhook.pipeline?.name ?? null
      }, tx);
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
        message: fkMessage(environmentId)
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
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to update a webhook.'
  }

  const userId = user.id;

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

  if (!pipelineId) return {
    status: 'error',
    message: 'Select a pipeline from the list.'
  }

  const environment = readEnvironmentId(formData);
  if (!environment) return {
    status: 'error',
    message: 'Select an environment from the list, or leave it empty.'
  }

  const { environmentId } = environment;

  try {
    await prisma.$transaction(async (tx) => {
      const { pipeline: prevPipeline } = await tx.webhook.findUniqueOrThrow({
        where: { id },
        select: { pipeline: { select: { name: true } } }
      });

      const prevName = prevPipeline?.name ?? null;

      const webhook = await tx.webhook.update({
        where: { id },
        data: { pipelineId, environmentId, branchFilters, events },
        select: { pipeline: { select: { name: true } } }
      });
      
      const name = webhook.pipeline?.name ?? null;

      // displays (none) incase a webhook has no pipeline
      const display = (n: string | null) => n ?? '(none)';

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.WEBHOOK_UPDATED,
        resourceType: ResourceType.WEBHOOK,
        resourceId: id,
        resourceLabel: prevName === name ? name : `${display(prevName)} → ${display(name)}`
      }, tx);
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
        message: fkMessage(environmentId)
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
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to delete a webhook.'
  }

  const userId = user.id;

  try {
    await prisma.$transaction(async (tx) => {
      const webhook = await tx.webhook.delete({
        where: { id },
        select: { pipeline: { select: { name: true } } }
      });

      await addAudit({
        userId: userId,
        actor: user.name ?? null,
        action: AuditAction.WEBHOOK_DELETED,
        resourceType: ResourceType.WEBHOOK,
        resourceId: id,
        resourceLabel: webhook.pipeline?.name ?? null
      }, tx);
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
      message: 'Saved regenerated secret!',
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
