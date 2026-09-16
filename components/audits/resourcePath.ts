import type { ResourceType } from '@/lib/types';

const RESOURCE_PATH: Record<ResourceType, string> = {
  "pipeline": "pipelines?id=",
  "pipeline-run": "runs/",
  "environment": "environments?id=",
  "secret": "secrets?id=",
  "webhook": "webhooks?id="
}

export function resourceHref(resourceType: ResourceType, resourceId: string) {
  return `/${RESOURCE_PATH[resourceType]}${resourceId}`;
}
