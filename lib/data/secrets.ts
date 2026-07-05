import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import type { Secret as PrismaSecret, EnvironmentType } from '@/generated/prisma';

export type Secret = Omit<PrismaSecret, 'encryptedValue' | 'authTag' | 'iv'> & {
  environment: {
    type: Lowercase<EnvironmentType>;
    name: string
  },
  createdBy?: string | null;
};

export type SecretDetail = Secret & { value: string };

export async function getSecrets(): Promise<Secret[]> {
  const secrets = await prisma.secret.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      environment: { 
        select: { type: true, name: true}
      }
    }
  });
  return secrets.map((s) => ({
    ...s,
    environment: {
      ...s.environment,
      type: s.environment.type.toLowerCase() as Secret["environment"]["type"],
    },
  }));
}

export async function getSecretById(id: string): Promise<SecretDetail | null> {
  const secret = await prisma.secret.findUnique({
    where: { id },
    include: {
      environment: {
        select: { type: true, name: true}
      },
      createdBy: { select: { name: true } }
    }
  });
  if (!secret) return null;
  const value = decryptSecret({
    encryptedValue: secret.encryptedValue,
    iv: secret.iv,
    authTag: secret.authTag,
  });
  return {
    ...secret,
    value,
    environment: {
      ...secret.environment,
      type: secret.environment.type.toLowerCase() as Secret["environment"]["type"],
    },
    createdBy: secret.createdBy?.name ?? null,
  };
}