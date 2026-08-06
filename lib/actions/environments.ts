"use server"

import { EnvType, FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { EnvironmentType } from '@/generated/prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';

// The UI works in lowercase domain types and Prisma's enum is uppercase, so the
// pairing is spelled out rather than upcased blindly: a new enum member fails to
// compile until it is mapped, the same way the readers in lib/data translate on
// the way out.
const ENV_TYPE_MAP: Record<EnvType, EnvironmentType> = {
  production: 'PRODUCTION',
  staging: 'STAGING',
  development: 'DEVELOPMENT',
  preview: 'PREVIEW',
  custom: 'CUSTOM',
};

/*
 * Returns undefined for anything the enum does not name, so the caller can reject
 * it before Prisma sees it. Handing Prisma an undefined type would not fail:
 * Environment.type carries @default(DEVELOPMENT), so a create would silently
 * store DEVELOPMENT and an update would silently leave the column untouched,
 * both reporting success. A server action is a POST endpoint, so a request that
 * omits the field entirely is a shape worth handling.
 */
function readEnvType(formData: FormData): EnvironmentType | undefined {
  const raw = formData.get('type');
  if (typeof raw !== 'string') return undefined;

  const key = raw.toLowerCase();
  return Object.hasOwn(ENV_TYPE_MAP, key) ? ENV_TYPE_MAP[key as EnvType] : undefined;
}

export async function addEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const name = formData.get('name') as string;
  const type = readEnvType(formData);
  const requireApproval = formData.get('requireApproval') === 'true';

  if (!type) {
    return {
      status: 'error',
      message: 'Error adding environment. Please choose a valid type.',
    };
  }

  try {
    await prisma.environment.create({
      data: { name, type, requireApproval, createdById },
    });

    revalidatePath('/environments');

    return { 
      status: 'success', 
      message: 'Environment added' 
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error adding environment. Please try again.',
    };
  }
}

export async function updateEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const type = readEnvType(formData);
  const requireApproval = formData.get('requireApproval') === 'true';

  if (!type) {
    return {
      status: 'error',
      message: 'Error updating environment. Please choose a valid type.',
    };
  }

  try {
    await prisma.environment.update({
      where: { id },
      data: { name, type, requireApproval },
    });

    revalidatePath('/environments');

    return { 
      status: 'success', 
      message: 'Environment updated' 
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error updating environment. Please try again.',
    };
  }
}

export async function deleteEnvironment(id: string): Promise<FormState> {
  try {
    const deletedEnv = await prisma.environment.delete({
      where: { id }
    });

    revalidatePath('/environments');

    return {
      status: 'success',
      message: `Environment ${deletedEnv.id} deleted`
    }

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}:` + 'Error deleting environment');
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting environment. Please try again.'
    }
  }
}