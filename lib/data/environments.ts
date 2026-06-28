import prisma from "@/lib/prisma";
import type { Environment as PrismaEnvironment } from "@/generated/prisma/client";

export type EnvType = 'production' | 'staging' | 'development' | 'preview' | 'custom';

export type Environment = Omit<PrismaEnvironment, "type"> & {
  secrets?: number;
  type: Lowercase<PrismaEnvironment["type"]>;
};

export async function getEnvironments(): Promise<Environment[]> {
  const envs = await prisma.environment.findMany({
    include: { secrets: true },
    orderBy: { createdAt: "desc" }
  });
  return envs.map((e) => (
    { ...e, secrets: e.secrets.length, type: e.type.toLowerCase() as Environment["type"] }
  ));
}

export async function getEnvironmentById(id: string): Promise<Environment | null> {
  const env = await prisma.environment.findUnique({
    where: { id: id },
    include: { secrets: true }
  });
  if (!env) return null;
  return { ...env, secrets: env.secrets.length, type: env.type.toLowerCase() as Environment["type"] };
}