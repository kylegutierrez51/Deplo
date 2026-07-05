"use server"

import { encryptSecret } from '../crypto';
import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';

export async function addSecret(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const key = formData.get('key') as string;
  const value = formData.get('value') as string;
  const environmentId = formData.get('env_id') as string;
  const notes = formData.get('notes') as string;

  const { encryptedValue, iv, authTag } = encryptSecret(value);

  try {
    await prisma.secret.create({
      data: { key, environmentId, encryptedValue, iv, authTag, notes, createdById },
    });

    revalidatePath('/secrets');

    return { 
      status: 'success', 
      message: 'Secret added'
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
      return { status: 'error', message: 'Selected environment no longer exists.' };
    }
    return {
      status: 'error',
      message: 'Error adding secret. Please try again.',
    };
  }
}

export async function updateSecret(prevState: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get('id') as string;
  const key = formData.get('key') as string;
  const value = formData.get('value') as string;
  const environmentId = formData.get('env_id') as string;
  const notes = formData.get('notes') as string;

  const { encryptedValue, iv, authTag } = encryptSecret(value);

  try {
    await prisma.secret.update({
      where: { id },
      data: { key, environmentId, encryptedValue, iv, authTag, notes },
    });

    revalidatePath('/secrets');

    return { 
      status: 'success', 
      message: 'Secret updated' 
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
      return { status: 'error', message: 'Selected environment no longer exists.' };
    }
    return {
      status: 'error',
      message: 'Error adding secret. Please try again.',
    };
  }
}

export async function deleteSecret(id: string): Promise<FormState> {
  try {
    const deletedSecret = await prisma.secret.delete({
      where: { id }
    });

    revalidatePath('/secrets');

    return {
      status: 'success',
      message: `Secret ${deletedSecret.id} deleted`
    }

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}:` + 'Error deleting secret');
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting secret. Please try again.'
    }
  }
}