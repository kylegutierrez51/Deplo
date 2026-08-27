"use server"

import { FormState, type ConfigJson, type CustomNode, type GraphJson, type SaveDefinitionResult } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from '@/auth';
import { definitionsEqual, toDefinition } from '@/lib/pipeline/definition';
import type { Edge } from '@xyflow/react';
import { Prisma } from '@/generated/prisma/client';
import { getEnvironmentById } from '../data/environments';
import { validatePipelineGraph } from '@/lib/pipeline/validation';
import { enqueueOrDiscardRun } from '@/lib/actions/run-trigger';

// Concurrent saves can compute the same next version and collide on the
// [pipelineId, version] unique constraint; the loser re-reads and tries again.
const SAVE_ATTEMPTS = 3;

export async function addPipeline(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  if (!createdById) return {
    status: 'error',
    message: 'Sign in to add a pipeline.'
  }

  const name = formData.get('name') as string;
  const repoUrl = formData.get('repo_url') as string;
  const description = formData.get('description') as string;

  try {
    await prisma.pipeline.create({
      data: {
        name, repoUrl, description, createdById,
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
  const session = await auth();

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to update a pipeline.'
  }
  
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const repoUrl = formData.get('repo_url') as string;
  const description = formData.get('description') as string;

  try {
    await prisma.pipeline.update({
      where: { id },
      data: { name, repoUrl, description },
    });

    revalidatePath('/pipelines');

    return {
      status: 'success',
      message: 'Pipeline updated'
    };

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This pipeline no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error updating pipeline. Please try again.',
    };
  }
}

export async function deletePipeline(id: string): Promise<FormState> {
  const session = await auth();

  if (!session?.user?.id) return {
    status: 'error',
    message: 'Sign in to delete a pipeline.'
  }

  try {
    await prisma.pipeline.delete({
      where: { id }
    });

    revalidatePath('/pipelines');

    return {
      status: 'success',
      message: `Pipeline deleted`
    }

  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}: ${error.message}`);
      return {
        status: 'error',
        message: 'This pipeline no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting pipeline. Please try again.'
    }
  }
}


// a save inserts an entirely new row with an incremented version
export async function savePipelineDefinition(pipelineId: string, nodes: CustomNode[], edges: Edge[]): Promise<SaveDefinitionResult> {
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  if (!createdById) return {
    status: 'error',
    message: 'Sign in to save a pipeline.'
  }

  const { graphJson, configJson } = toDefinition(nodes, edges);

  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
    try {
      const definitionId = await prisma.$transaction(async (tx) => {
        const latest = await tx.pipelineDefinition.findFirst({
          where: { pipelineId },
          orderBy: { version: 'desc' },
          select: { id: true, version: true, graphJson: true, configJson: true },
        });

        // A save that changed nothing reuses the current version instead of creating a duplicate
        // meaning a new version counts distinct updates, to prevent new rows when a user spams 'Save' 
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
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

// Drop definitions that do not have a run associated with it
// Since Deplo can't go back to previous versions, deletes previous pipeline definitions with no runs 
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

export async function addPipelineRun(pipelineId: string, environmentId: string | null, nodes: CustomNode[], edges: Edge[]): Promise<FormState & { runId?: string }> {
  const session = await auth();
  const triggeredById = session?.user?.id ?? null;

  if (!triggeredById) return {
    status: 'error',
    message: 'Sign in to run a pipeline.'
  }

  if (!environmentId) return {
    status: 'error',
    message: 'Select an environment to target.'
  }

  try {
    const latest = await prisma.pipelineDefinition.findFirst({
      where: { pipelineId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, graphJson: true, configJson: true },
    });

    if (!latest) return {
      status: 'error',
      message: 'Save your current pipeline'
    }

    const { graphJson, configJson } = toDefinition(nodes, edges);

    // A run pins itself to a stored definition, so the editor has to match one.
    if (!definitionsEqual({ graphJson, configJson }, latest)) {
      return {
        status: 'error',
        message: 'Save or discard your current changes!'
      }
    }

    const isReadyState = await verifyPipelineRunReady({ graphJson, configJson }, environmentId);

    if (isReadyState.status === 'error') return isReadyState;

    const pipelineRun = await prisma.pipelineRun.create({
      select: { id: true },
      data: {
        pipelineId, definitionId: latest.id, trigger: "MANUAL", triggeredById, environmentId
      }
    });

    // Takes the row back rather than leaving it stranded at QUEUED — see run-trigger.ts.
    if (!await enqueueOrDiscardRun(pipelineRun.id)) return {
      status: 'error',
      message: 'Could not reach the job queue, so the run was not started. Please try again.'
    }

    revalidatePath('/pipelines');
    revalidatePath('/runs');

    return {
      status: 'success',
      message: 'Pipeline Run Triggered!',
      runId: pipelineRun.id
    };

  } catch (error: unknown) {
    // P2003: the definition or environment the run points at was deleted between the checks above and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2003' || error.code === 'P2025')) {
      return {
        status: 'error',
        message: 'This pipeline or environment no longer exists.'
      }
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error triggering pipeline. Please try again.'
    }
  }
}




async function verifyPipelineRunReady(definition: { graphJson: GraphJson, configJson: ConfigJson }, environmentId: string): Promise<FormState> {
  const { graphJson, configJson } = definition;

  if (!graphJson.nodes.length) return {
    status: 'error',
    message: 'This pipeline has no stages. Add at least one.'
  }

  // The environment is fetched before the graph checks rather than after because requireApproval decides whether one of them runs at all. It is the only round trip here.
  const environment = await getEnvironmentById(environmentId);

  if (!environment) return {
    status: 'error',
    message: 'The selected environment no longer exists. Pick another.'
  }

  const errors = validatePipelineGraph(graphJson, configJson, environment.requireApproval);

  if (errors.length) return {
    status: 'error',
    message: ['Cannot run pipeline:', ...errors.map(error => `• ${error}`)].join('\n')
  }

  return {
    status: 'success',
    message: ''
  }
}