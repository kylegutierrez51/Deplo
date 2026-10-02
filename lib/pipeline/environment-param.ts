// In the Pipeline Editor, when no environment is selected, makes the URL: `?environment=none`
export const NO_ENVIRONMENT = 'none';



/**
 * If `?environment=none`, return null.
 * If `?environment=<id>`, return that id.
 * If the default environment is present in the input, return its id.
 * Else, return null.
 * 
 * Having a defaultEnvironment initially set does not set `?environment=<defaultEnvironmentId>`.
 * When the defaultEnvironment is removed by the user, the URL is set to `?environment=none`.
 * When the URL names an environment that doesn't exist, fallback to the default environment
 * Having `?environment=a&environment=b` falls back to the default environment
 * 
 */
export function resolveInitialEnvironment(
  param: string | string[] | undefined,
  defaultEnvironmentId: string | null,
  environmentIds: string[],
): string | null {
  if (param === NO_ENVIRONMENT) return null;
  if (typeof param === 'string' && environmentIds.includes(param)) return param;
  if (defaultEnvironmentId && environmentIds.includes(defaultEnvironmentId)) return defaultEnvironmentId;
  return null;
}
