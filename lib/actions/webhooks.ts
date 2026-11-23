"use server"

import { encryptSecret, generateWebhookSecret } from '@/lib/utils/crypto';
import { FormState, EventType } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from '@/generated/prisma/client';
import { EventType as PrismaEventType, AuditAction, ResourceType } from '@/generated/prisma';
import { auth } from '@/auth';
import { addAudit } from './audits';
import { createWebhookSchema, updateWebhookSchema } from '@/lib/validation';

const EVENT_TYPE_MAP: Record<EventType, PrismaEventType> = {
  push: 'PUSH',
  'pull-request': 'PULL_REQUEST',
  ping: 'PING',
  unrecognized: 'UNRECOGNIZED'
};

function readWebhookFormData(formData: FormData) {
  return {
    pipelineId: formData.get('pipeline_id'),
    environmentId: formData.get('environment_id'),
    environmentName: formData.get('environment_name'),
    branchFilters: formData.getAll('branch_filters'),
    events: formData.getAll('events'),
    isActive: formData.get('is_active'),
    relayUrl: formData.get('relay_url'),
  };
}

const fkMessage =(environmentId: string | null) =>
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

  const result = createWebhookSchema.safeParse({
    ...readWebhookFormData(formData),
    secret: formData.get('webhook_secret'),
  });
  if (!result.success) {
    return {
      status: 'error',
      message: result.error.issues.map(issue => issue.message).join('\n'),
    };
  }

  const { pipelineId, environmentId, branchFilters, secret, isActive, relayUrl } = result.data;
  const events = result.data.events.map(event => EVENT_TYPE_MAP[event]);
  
  const { encryptedValue, iv, authTag } = encryptSecret(secret);

  try {
    await prisma.$transaction(async (tx) => {
      const webhook = await tx.webhook.create({
        data: { pipelineId, environmentId, isActive, branchFilters, events, encryptedValue, iv, authTag, createdById, relayUrl },
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

  const result = updateWebhookSchema.safeParse({
    ...readWebhookFormData(formData),
    id: formData.get('id'),
  });
  if (!result.success) {
    return {
      status: 'error',
      message: result.error.issues.map(issue => issue.message).join('\n'),
    };
  }

  const { id, pipelineId, environmentId, branchFilters, isActive, relayUrl } = result.data;
  const events = result.data.events.map(event => EVENT_TYPE_MAP[event]);

  try {
    await prisma.$transaction(async (tx) => {
      const { pipeline: prevPipeline } = await tx.webhook.findUniqueOrThrow({
        where: { id },
        select: { pipeline: { select: { name: true } } }
      });

      const prevName = prevPipeline?.name ?? null;

      const webhook = await tx.webhook.update({
        where: { id },
        data: { pipelineId, environmentId, isActive, branchFilters, events, relayUrl },
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
