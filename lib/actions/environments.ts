"use server"

import { EnvType, FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { Prisma } from '@/generated/prisma/client';
import { EnvironmentType, AuditAction, ResourceType } from '@/generated/prisma';
import { auth } from '@/auth';
import { addAudit } from './audits';
import { environmentSchema } from '../validation';

const ENV_TYPE_MAP: Record<EnvType, EnvironmentType> = {
  production: 'PRODUCTION',
  staging: 'STAGING',
  development: 'DEVELOPMENT',
  preview: 'PREVIEW',
  custom: 'CUSTOM',
};



export async function addEnvironment(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const user = session?.user;
  const createdById = user?.id ?? null;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to add an environment.'
  }

  const userId = user.id;

  const result = environmentSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    requireApproval: formData.get('requireApproval')
  });

  if (!result.success) {
    return {
      status: 'error',
      message: result.error.issues.map(issue => issue.message).join('\n'),
    };
  }

  const { name, type, requireApproval } = result.data;


  try {
    await prisma.$transaction(async (tx) => {
      const env = await tx.environment.create({
        data: { name, type: ENV_TYPE_MAP[type], requireApproval, createdById },
        select: { id: true, name: true, type: true }
      });

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.ENVIRONMENT_CREATED,
        resourceType: ResourceType.ENVIRONMENT,
        resourceId: env.id,
        resourceLabel: env.name + " (" + env.type + ")",
        resourceMeta: { kind: 'environment', name: env.name, type }
      }, tx);
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
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to update an environment.'
  }

  const userId = user.id;

  const id = formData.get('id') as string;

  const result = environmentSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    requireApproval: formData.get('requireApproval')
  });

  if (!result.success) {
    return {
      status: 'error',
      message: result.error.issues.map(issue => issue.message).join('\n'),
    };
  }

  const { name, type, requireApproval } = result.data;

  if (!type) {
    return {
      status: 'error',
      message: 'Error updating environment. Please choose a valid type.',
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const { name: prevName, type: prevType } = await tx.environment.findUniqueOrThrow({
        where: { id },
        select: { name: true, type: true }
      });
      
      await tx.environment.update({
        where: { id },
        data: { name, type: ENV_TYPE_MAP[type], requireApproval },
      });

      const auditedName = prevName === name ? name : `${prevName} → ${name}`
      const auditedType = prevType === ENV_TYPE_MAP[type] ? type : `${prevType.toLowerCase()} → ${type}`

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.ENVIRONMENT_UPDATED,
        resourceType: ResourceType.ENVIRONMENT,
        resourceId: id,
        resourceLabel: auditedName + " (" + auditedType + ")",
        resourceMeta: {
          kind: 'environment',
          name,
          type,
          ...(prevName !== name && { prevName }),
          ...(prevType !== ENV_TYPE_MAP[type] && { prevType: prevType.toLowerCase() as EnvType }),
        }
      }, tx);
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
  const session = await auth();
  const user = session?.user;

  if (!user?.id) return {
    status: 'error',
    message: 'Sign in to delete an environment.'
  }

  const userId = user.id;

  try {
    await prisma.$transaction(async (tx) => {
      const env = await tx.environment.delete({
        where: { id },
        select: { name: true, type: true }
      });

      await addAudit({
        userId,
        actor: user.name ?? null,
        action: AuditAction.ENVIRONMENT_DELETED,
        resourceType: ResourceType.ENVIRONMENT,
        resourceId: id,
        resourceLabel: env.name + " (" + env.type + ")",
        resourceMeta: { kind: 'environment', name: env.name, type: env.type.toLowerCase() as EnvType }
      }, tx);
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