import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/utils/crypto';
import type { Secret as PrismaSecret, EnvironmentType } from '@/generated/prisma';
import { ALL, SECRET_FILTERS, type SecretFilters } from '@/lib/filters/options';
import { parseFilters } from '@/lib/filters/parse';

export type Secret = Omit<PrismaSecret, 'encryptedValue' | 'authTag' | 'iv'> & {
  environment: {
    type: Lowercase<EnvironmentType>;
    name: string
  },
  createdBy?: string | null;
};

export type SecretDetail = Secret & { value: string };

export async function getSecrets(filters: SecretFilters = parseFilters({}, SECRET_FILTERS)): Promise<Secret[]> {
  const { environment } = filters;

  const secrets = await prisma.secret.findMany({
    where: {
      ...(environment !== ALL && { environment: { type: environment.toUpperCase() as EnvironmentType } }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      environment: {
        select: { type: true, name: true }
      }
    },
    omit: { encryptedValue: true, iv: true, authTag: true }
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
        select: { type: true, name: true }
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

  const { encryptedValue: _ev, iv: _iv, authTag: _at, ...rest } = secret;

  return {
    ...rest,
    value,
    environment: {
      ...secret.environment,
      type: secret.environment.type.toLowerCase() as Secret["environment"]["type"],
    },
    createdBy: secret.createdBy?.name ?? null,
  };
}