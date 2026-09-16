"use server"

import { encryptSecret } from '@/lib/utils/crypto';
import { EnvType, FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from '@/auth';
import { Prisma } from '@/generated/prisma/client';
import { addAudit } from './audits';
import { AuditAction, ResourceType } from '@/generated/prisma';

export async function addSecret(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const user = session?.user;
  const createdById = user?.id ?? null;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to add a secret.'
  }

  const userId = user.id;

  const key = formData.get('key') as string;
  const value = formData.get('value') as string;
  const environmentId = formData.get('env_id') as string;
  const notes = formData.get('notes') as string;

  const { encryptedValue, iv, authTag } = encryptSecret(value);

  try {
    await prisma.$transaction(async (tx) => {
      const secret = await tx.secret.create({
        data: { key, environmentId, encryptedValue, iv, authTag, notes, createdById },
        select: { id: true, environment: { select: { type: true } } }
      });

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.SECRET_CREATED,
        resourceType: ResourceType.SECRET,
        resourceId: secret.id,
        resourceLabel: key + " (" + secret.environment.type + ")",
        resourceMeta: { kind: 'secret', key, type: secret.environment.type.toLowerCase() as EnvType }
      }, tx);
    });

    revalidatePath('/secrets');

    return { 
      status: 'success', 
      message: 'Secret added'
    };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(`${error.code}: ${error.message}`);

      if (error.code === 'P2003') return {
        status: 'error',
        message: 'Selected environment no longer exists.'
      }

      // @@unique([environmentId, key])
      if (error.code === 'P2002') return {
        status: 'error',
        message: 'The key is already registered to the selected environment. Enter a new key or select a different environment.'
      }
    }

    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error adding secret. Please try again.',
    };
  }
}

export async function updateSecret(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to update a secret.'
  }

  const userId = user.id;

  const id = formData.get('id') as string;
  const key = formData.get('key') as string;
  const value = formData.get('value') as string;
  const environmentId = formData.get('env_id') as string;
  const notes = formData.get('notes') as string;

  const { encryptedValue, iv, authTag } = encryptSecret(value);

  try {
    await prisma.$transaction(async (tx) => {
      const { key: prevKey, environment: { type } } = await tx.secret.findUniqueOrThrow({
        where: { id },
        select: { key: true, environment: { select: { type: true }} }
      });

      await tx.secret.update({
        where: { id },
        data: { key, environmentId, encryptedValue, iv, authTag, notes },
      });

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.SECRET_UPDATED,
        resourceType: ResourceType.SECRET,
        resourceId: id,
        resourceLabel: (prevKey === key ? key : `${prevKey} → ${key}`) + " (" + type + ")",
        resourceMeta: {
          kind: 'secret',
          key,
          type: type.toLowerCase() as EnvType,
          ...(prevKey !== key && { prevKey }),
        }
      }, tx);
    });


    revalidatePath('/secrets');

    return { 
      status: 'success', 
      message: 'Secret updated' 
    };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(`${error.code}: ${error.message}`);

      if (error.code === 'P2003') return {
        status: 'error',
        message: 'Selected environment no longer exists.'
      }

      // @@unique([environmentId, key])
      if (error.code === 'P2002') return {
        status: 'error',
        message: 'The key is already registered to the selected environment. Enter a new key or select a different environment.'
      }

      if (error.code === 'P2025') return {
        status: 'error',
        message: 'This secret no longer exists.'
      }
    }

    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error updating secret. Please try again.',
    };
  }
}

export async function deleteSecret(id: string): Promise<FormState> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to delete a secret.'
  }

  const userId = user.id;

  try {
    await prisma.$transaction(async (tx) => {
      const secret = await tx.secret.delete({
        where: { id },
        select: { id: true, key: true, environment: { select: { type: true }}}
      });

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.SECRET_DELETED,
        resourceType: ResourceType.SECRET,
        resourceId: secret.id,
        resourceLabel: secret.key + " (" + secret.environment.type + ")",
        resourceMeta: { kind: 'secret', key: secret.key, type: secret.environment.type.toLowerCase() as EnvType }
      }, tx);
    });

    revalidatePath('/secrets');

    return {
      status: 'success',
      message: `Secret deleted`
    }

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This secret no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting secret. Please try again.'
    }
  }
}