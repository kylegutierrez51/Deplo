"use server"

import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { EnvironmentType } from '@/generated/prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';

export async function addEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  console.log('session user:', session?.user);
  const createdById = session?.user?.id ?? null;

  const name = formData.get('name') as string;
  const type = (formData.get('type') as string).toUpperCase() as EnvironmentType;
  const requireApproval = formData.get('requireApproval') === 'true';

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
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error adding pipeline. Please try again.',
    };
  }
}

export async function updateEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const type = (formData.get('type') as string).toUpperCase() as EnvironmentType;
  const requireApproval = formData.get('requireApproval') === 'true';

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
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error editing environment. Please try again.',
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
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error deleting environment. Please try again.'
    }
  }
}