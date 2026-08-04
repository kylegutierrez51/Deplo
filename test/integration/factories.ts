import prisma from '@/lib/prisma';
import { toDefinition } from '@/lib/pipeline/definition';
import type { CustomNode } from '@/lib/types';
import type { Edge } from '@xyflow/react';
import type { Prisma } from '@/generated/prisma/client';

/*
 * Small builders for integration tests. Deliberately not prisma/seed.ts, which
 * wipes everything and creates ten of each — a test wants one row it controls,
 * and the truncate in setup.ts already handles isolation.
 */

let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${counter++}`;

export function makeUser(over: Partial<{ name: string; email: string }> = {}) {
  return prisma.user.create({
    data: { name: 'kyle', email: unique('user') + '@example.com', ...over },
  });
}

export function makePipeline(over: Partial<{ name: string; repoUrl: string; createdById: string }> = {}) {
  return prisma.pipeline.create({
    data: {
      name: over.name ?? unique('pipeline'),
      repoUrl: over.repoUrl ?? 'https://github.com/kylegutierrez51/deplo',
      createdById: over.createdById ?? null,
    },
  });
}

export function makeEnvironment(over: Partial<{ name: string; requireApproval: boolean; createdById: string }> = {}) {
  return prisma.environment.create({
    data: {
      name: over.name ?? unique('env'),
      type: 'DEVELOPMENT',
      requireApproval: over.requireApproval ?? false,
      createdById: over.createdById ?? null,
    },
  });
}

/** A definition at an explicit version, built through the real serializer. */
export function makeDefinition(pipelineId: string, version: number, nodes: CustomNode[] = [], edges: Edge[] = []) {
  const { graphJson, configJson } = toDefinition(nodes, edges);
  return prisma.pipelineDefinition.create({
    data: {
      pipelineId,
      version,
      // Same cast lib/actions/pipelines.ts uses: GraphJson is a structural type,
      // and Prisma's InputJsonValue demands an index signature it does not have.
      graphJson: graphJson as unknown as Prisma.InputJsonValue,
      configJson,
    },
  });
}

export function makeRun(pipelineId: string, definitionId: string, triggeredById: string) {
  return prisma.pipelineRun.create({
    data: { pipelineId, definitionId, trigger: 'MANUAL', triggeredById },
  });
}

export const stage = (id: string, over: Partial<CustomNode['data']> = {}): CustomNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: 'custom', name: id, command: 'npm test', ...over },
});
