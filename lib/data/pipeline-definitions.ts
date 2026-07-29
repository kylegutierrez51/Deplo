import prisma from '@/lib/prisma';
import { fromDefinition } from '@/lib/pipeline-definition';
import type { GraphJson } from '@/lib/types';

export async function getPipelineDefinition(pipelineId: string): Promise<GraphJson> {
  const definition = await prisma.pipelineDefinition.findFirst({
    where: { pipelineId },
    orderBy: { version: 'desc' },
  });

  if (!definition) return { nodes: [], edges: [] };

  return fromDefinition(definition.graphJson, definition.configJson);
}
