"use server"

import { EnvType, FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { EnvironmentType, Prisma } from '@/generated/prisma/client';
import { auth } from '@/auth';

const ENV_TYPE_MAP: Record<EnvType, EnvironmentType> = {
  production: 'PRODUCTION',
  staging: 'STAGING',
  development: 'DEVELOPMENT',
  preview: 'PREVIEW',
  custom: 'CUSTOM',
};


function readEnvType(formData: FormData): EnvironmentType | undefined {
  const raw = formData.get('type');
  if (typeof raw !== 'string') return undefined;

  const key = raw.toLowerCase();
  return Object.hasOwn(ENV_TYPE_MAP, key) ? ENV_TYPE_MAP[key as EnvType] : undefined;
}

export async function addEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  if (!createdById) return {
    status: 'error',
    message: 'Sign in to add an environment.'
  }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'Environment name already used. Try a new one.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error adding environment. Please try again.',
    };
  }
}

export async function updateEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to update an environment.'
  }
  
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log(`${error.code}: ${error.message}`);

      if (error.code === 'P2002') return {
        status: 'error',
        message: 'Environment name already used. Try a new one.'
      }

      if (error.code === 'P2025') return {
        status: 'error',
        message: 'This environment no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error updating environment. Please try again.',
    };
  }
}

export async function deleteEnvironment(id: string): Promise<FormState> {
  try {
    const session = await auth();

    if (!session?.user?.id) return {
      status: 'error',
      message: 'Sign in to delete an environment.'
    }

    await prisma.environment.delete({
      where: { id }
    });

    revalidatePath('/environments');

    return {
      status: 'success',
      message: `Environment deleted`
    }

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This environment no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting environment. Please try again.'
    }
  }
}