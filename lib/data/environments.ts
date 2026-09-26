import prisma from "@/lib/prisma";
import type { Environment as PrismaEnvironment, EnvironmentType } from "@/generated/prisma/client";
import { ALL, ENVIRONMENT_FILTERS, type EnvironmentFilters } from "@/lib/filters/options";
import { dateRangeCutoff, parseFilters } from "@/lib/filters/parse";
import { DEFAULT_PAGE_SIZE, pageWindow, type Page } from "@/lib/utils/pagination";

export type Environment = Omit<PrismaEnvironment, "type" | "createdById"> & {
  secrets: number;
  type: Lowercase<PrismaEnvironment["type"]>;
  createdBy?: string | null;
};

function environmentsWhere({ environment, updated }: EnvironmentFilters) {
  const updatedSince = dateRangeCutoff(updated);
  return {
    ...(environment !== ALL && { type: environment.toUpperCase() as EnvironmentType }),
    ...(updatedSince && { updatedAt: { gte: updatedSince } }),
  };
}

async function findEnvironments(args: { where: ReturnType<typeof environmentsWhere>; skip?: number; take?: number }): Promise<Environment[]> {
  const envs = await prisma.environment.findMany({
    ...args,
    include: { secrets: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
  return envs.map((e) => (
    { ...e, secrets: e.secrets.length, type: e.type.toLowerCase() as Environment["type"] }
  ));
}

// Unpaginated: the secret modal and pipeline editor pickers need every environment
export async function getEnvironments(filters: EnvironmentFilters = parseFilters({}, ENVIRONMENT_FILTERS)): Promise<Environment[]> {
  return findEnvironments({ where: environmentsWhere(filters) });
}

export async function getEnvironmentsPage(filters: EnvironmentFilters, page: number, pageSize = DEFAULT_PAGE_SIZE): Promise<Page<Environment>> {
  const where = environmentsWhere(filters);
  const total = await prisma.environment.count({ where });
  const { skip, take, ...meta } = pageWindow(page, total, pageSize);

  return { rows: await findEnvironments({ where, skip, take }), total, ...meta };
}

export async function getEnvironmentById(id: string): Promise<Environment | null> {
  const env = await prisma.environment.findUnique({
    where: { id },
    include: { secrets: true, createdBy: { select: { name: true } } }
  });
  if (!env) return null;

  return {
    ...env,
    secrets: env.secrets.length,
    type: env.type.toLowerCase() as Environment["type"],
    createdBy: env.createdBy?.name ?? null,
  };
}