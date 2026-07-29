"use server"

import { FormState, type CustomNode, type SaveDefinitionResult } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';
import { definitionsEqual, toDefinition } from '@/lib/pipeline-definition';
import type { Edge } from '@xyflow/react';
import type { Prisma } from '@/generated/prisma/client';

// Concurrent saves can compute the same next version and collide on the
// [pipelineId, version] unique constraint; the loser re-reads and tries again.
const SAVE_ATTEMPTS = 3;

export async function addPipeline(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const name = formData.get('name') as string;
  const repoUrl = formData.get('repo_url') as string;
  const description = formData.get('description') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];

  try {
    await prisma.pipeline.create({
      data: {
        name, repoUrl, description, branchFilters, createdById,
        definitions: {
          create: { version: 0, graphJson: { nodes: [], edges: [] }, configJson: {}, createdById },
        },
      },
    });

    revalidatePath('/pipelines');

    return {
      status: 'success',
      message: 'Pipeline added'
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error adding pipeline. Please try again.',
    };
  }
}

export async function updatePipeline(prevState: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const repoUrl = formData.get('repo_url') as string;
  const description = formData.get('description') as string;
  const branchFilters = formData.getAll('branch_filters') as string[];

  try {
    await prisma.pipeline.update({
      where: { id },
      data: { name, repoUrl, description, branchFilters },
    });

    revalidatePath('/pipelines');

    return {
      status: 'success',
      message: 'Pipeline updated'
    };

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Error updating pipeline. Please try again.',
    };
  }
}

export async function deletePipeline(id: string): Promise<FormState> {
  try {
    const deletedPipeline = await prisma.pipeline.delete({
      where: { id }
    });

    revalidatePath('/pipelines');

    return {
      status: 'success',
      message: `Pipeline ${deletedPipeline.id} deleted`
    }

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}:` + 'Error deleting pipeline');
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting pipeline. Please try again.'
    }
  }
}

/**
 * Definitions are immutable: a save inserts a new version rather than editing
 * the current row, so every PipelineRun keeps resolving to the exact graph it
 * executed and the Run Detail page stays truthful. Superseded versions that no
 * run references are then swept away, leaving only the current version plus the
 * ones that actually ran.
 */
export async function savePipelineDefinition(pipelineId: string, nodes: CustomNode[], edges: Edge[]): Promise<SaveDefinitionResult> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const { graphJson, configJson } = toDefinition(nodes, edges);

  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
    try {
      const definitionId = await prisma.$transaction(async (tx) => {
        const latest = await tx.pipelineDefinition.findFirst({
          where: { pipelineId },
          orderBy: { version: 'desc' },
          select: { id: true, version: true, graphJson: true, configJson: true },
        });

        // A save that changed nothing reuses the current version instead of
        // minting a duplicate, so version counts distinct configurations rather
        // than presses of the Save button.
        if (latest && definitionsEqual({ graphJson, configJson }, latest)) return latest.id;

        // Versions are monotonic and never reused, so the sweep below leaves
        // them sparse (0, 1, 4, 9...) — a version is the nth edit ever made.
        const created = await tx.pipelineDefinition.create({
          data: {
            pipelineId,
            version: (latest?.version ?? -1) + 1,
            graphJson: graphJson as unknown as Prisma.InputJsonValue,
            configJson,
            createdById,
          },
          select: { id: true },
        });

        return created.id;
      });

      await deleteStaleDefinitions(pipelineId, definitionId);

      revalidatePath('/pipelines');
      revalidatePath(`/pipelines/${pipelineId}`);

      return {
        status: 'success',
        message: 'Pipeline saved',
        definitionId
      };

    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        // Lost the race for this version number — re-read the latest and retry.
        if (error.code === 'P2002' && attempt < SAVE_ATTEMPTS) continue;

        // P2003: the pipeline the new definition points at is gone.
        if (error.code === 'P2003' || error.code === 'P2025') {
          return { status: 'error', message: 'This pipeline no longer exists.' };
        }
      }
      console.log(error instanceof Error ? error.message : '');
      return {
        status: 'error',
        message: 'Error saving pipeline. Please try again.'
      };
    }
  }

  return {
    status: 'error',
    message: 'Error saving pipeline. Please try again.'
  };
}

/**
 * Drops every definition of this pipeline except `keepId` that no run
 * references — a sweep rather than a delete of just the superseded row, so a
 * sweep that failed earlier gets cleaned up on the next save.
 *
 * Runs outside the save's transaction and swallows its own errors on purpose.
 * PipelineRun references its definition ON DELETE RESTRICT, so a run created
 * between the lookup and the delete makes the delete fail instead of orphaning
 * the run, and the definition simply survives until the next sweep. Rolling the
 * user's save back over that would be the wrong trade.
 */
async function deleteStaleDefinitions(pipelineId: string, keepId: string): Promise<void> {
  try {
    // deleteMany can't filter on a to-many relation, so collect the ids first.
    const stale = await prisma.pipelineDefinition.findMany({
      where: {
        pipelineId,
        id: { not: keepId },
        runs: { none: {} },
      },
      select: { id: true },
    });

    if (!stale.length) return;

    await prisma.pipelineDefinition.deleteMany({
      where: { id: { in: stale.map(definition => definition.id) } },
    });

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
  }
}
