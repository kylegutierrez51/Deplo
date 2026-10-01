import type { EnvironmentType as PrismaEnvironmentType } from "@/generated/prisma";
import type { EnvType, RunEnvironment } from "@/lib/types";

const ENV_TYPE_MAP: Record<PrismaEnvironmentType, EnvType> = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  PREVIEW: 'preview',
  CUSTOM: 'custom',
};

/*
==============================================================================================
 * The environment a run targeted, for display.
 *
 * When a run's environment is deleted, it falls back to 'environmentName' and 'environmentType'
 * Those two are the recorded name and type of the deleted environment.
 *
 * Returns null only for a run that never had an environment.
==============================================================================================
*/
export function toRunEnvironment(run: {
  environment: { name: string; type: PrismaEnvironmentType } | null;
  environmentName: string | null;
  environmentType: PrismaEnvironmentType | null;
}): RunEnvironment | null {
  if (run.environment) {
    return { name: run.environment.name, type: ENV_TYPE_MAP[run.environment.type], deleted: false };
  }

  if (run.environmentName) {
    return {
      name: run.environmentName,
      type: run.environmentType ? ENV_TYPE_MAP[run.environmentType] : null,
      deleted: true,
    };
  }

  return null;
}
