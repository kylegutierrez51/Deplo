"use server"

import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';

export async function addPipeline(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const name = formData.get('name') as string;
  const repoUrl = formData.get('repo_url') as string;
  const description = formData.get('description') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];

  try {
    await prisma.pipeline.create({
      data: { name, repoUrl, description, branchFilters, createdById },
    });

    revalidatePath('/pipelines');

    return { 
      status: 'success', 
      message: 'Pipeline added'
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error adding pipeline. Please try again.',
    };
  }
}

export async function updatePipeline(prevState: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const repoUrl = formData.get('repo_url') as string;
  const description = formData.get('description') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];

  try {
    await prisma.pipeline.update({
      where: { id },
      data: { name, repoUrl, description, branchFilters },
    });

    revalidatePath('/pipelines');

    return { 
      status: 'success', 
      message: 'Pipeline updated' 
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error updating pipeline. Please try again.',
    };
  }
}

export async function deletePipeline(id: string): Promise<FormState> {
  try {
    const deletedPipeline = await prisma.pipeline.delete({
      where: { id }
    });

    revalidatePath('/pipelines');

    return {
      status: 'success',
      message: `Pipeline ${deletedPipeline.id} deleted`
    }

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}:` + 'Error deleting pipeline');
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting pipeline. Please try again.'
    }
  }
}