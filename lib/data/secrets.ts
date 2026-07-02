import prisma from '@/lib/prisma';
import type { Secret as PrismaSecret } from '@/generated/prisma';

export type Secret = Omit<PrismaSecret, 'encryptedValue' | 'authTag' | 'iv'>;

export async function getSecrets(): Promise<Secret[]> {
  return await prisma.secret.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      environment: { 
        select: { type: true, name: true}
      }
    }
  });
}

export async function getSecretById(id: string): Promise<Secret | null> {
  return await prisma.secret.findUnique({
    where: { id },
    include: {
      environment: { 
        select: { type: true, name: true}
      }
    }
  });
}