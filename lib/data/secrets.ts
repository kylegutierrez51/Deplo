import prisma from '@/lib/prisma';
import { decryptSecret } from '@/lib/utils/crypto';
import type { Secret as PrismaSecret, EnvironmentType } from '@/generated/prisma';
import { ALL, SECRET_FILTERS, type SecretFilters } from '@/lib/filters/options';
import { dateRangeCutoff, parseFilters } from '@/lib/filters/parse';
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from '@/lib/utils/pagination';

export type Secret = Omit<PrismaSecret, 'encryptedValue' | 'authTag' | 'iv'> & {
  environment: {
    type: Lowercase<EnvironmentType>;
    name: string
  },
  createdBy?: string | null;
};

export type SecretDetail = Secret & { value: string };

function secretsWhere({ environment, updated }: SecretFilters) {
  const updatedSince = dateRangeCutoff(updated);
  return {
    ...(environment !== ALL && { environment: { type: environment.toUpperCase() as EnvironmentType } }),
    ...(updatedSince && { updatedAt: { gte: updatedSince } }),
  };
}

async function findSecrets(args: { where: ReturnType<typeof secretsWhere>; skip?: number; take?: number }): Promise<Secret[]> {
  const secrets = await prisma.secret.findMany({
    ...args,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

// Unpaginated: Used by the pipeline editor to get every secret for a selected environment
export async function getSecrets(filters: SecretFilters = parseFilters({}, SECRET_FILTERS)): Promise<Secret[]> {
  return findSecrets({ where: secretsWhere(filters) });
}

export async function getSecretsPage(filters: SecretFilters, page: number, pageSize = DEFAULT_PAGE_SIZE): Promise<Page<Secret>> {
  const where = secretsWhere(filters);
  const total = await prisma.secret.count({ where });
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  return { rows: await findSecrets({ where, skip, take }), total, ...meta };
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