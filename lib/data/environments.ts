import prisma from "@/lib/prisma";
import type { Environment as PrismaEnvironment, EnvironmentType } from "@/generated/prisma/client";
import { ALL, ENVIRONMENT_FILTERS, type EnvironmentFilters } from "@/lib/filters/options";
import { dateRangeCutoff, parseFilters } from "@/lib/filters/parse";

export type Environment = Omit<PrismaEnvironment, "type" | "createdById"> & {
  secrets: number;
  type: Lowercase<PrismaEnvironment["type"]>;
  createdBy?: string | null;
};

export async function getEnvironments(filters: EnvironmentFilters = parseFilters({}, ENVIRONMENT_FILTERS)): Promise<Environment[]> {
  const { environment, updated } = filters;
  const updatedSince = dateRangeCutoff(updated);

  const envs = await prisma.environment.findMany({
    where: {
      ...(environment !== ALL && { type: environment.toUpperCase() as EnvironmentType }),
      ...(updatedSince && { updatedAt: { gte: updatedSince } }),
    },
    include: { secrets: true },
    orderBy: { createdAt: "desc" }
  });
  return envs.map((e) => (
    { ...e, secrets: e.secrets.length, type: e.type.toLowerCase() as Environment["type"] }
  ));
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