import prisma from '@/lib/prisma';
import { fromDefinition } from '@/lib/pipeline/definition';
import { RUNNER_WORKSPACE_ROOT } from './connection';
import type { GraphJson, StageType } from '@/lib/types';
import type { RunStatus, StageStatus } from '@/generated/prisma';
import type { Prisma, StageType as PrismaStageType } from '@/generated/prisma/client';
import type { Outcomes } from './scheduler';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const STAGE_TYPE_MAP: Record<StageType, PrismaStageType> = {
  custom: 'CUSTOM',
  deploy: 'DEPLOY',
  approval: 'APPROVAL',
};

interface RunContext {
  runId: string,
  runStatus: RunStatus,
  definitionId: string,
  environmentId: string | null,
  graph: GraphJson,
  outcomes: Outcomes,
}


/*
==============================================================================================
 * The runner's only read. Everything a run needs to make its next decision — the graph,
 * the per-stage config, and the current state of every stage — in one query.
 *
 * There is no `config` field because there is no need for one: fromDefinition folds
 * configJson into each node's `data`, so command/timeout/retries/env_vars/secrets ride
 * along on the graph. A node with no config entry simply arrives with those keys absent
==============================================================================================
 */
export async function loadRunContext(runId: string): Promise<RunContext | null> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: {
      definition: { select: { graphJson: true, configJson: true } },
      stages: {
        select: { stageId: true, status: true },
        // Load-bearing, and paired with the fold below: that fold is last-write-wins, so
        // ascending attempt is what makes "last" mean "the latest attempt". Ordering by
        // createdAt instead would be undefined for two rows written in the same
        // millisecond, and a stage that failed and then succeeded on retry could report
        // FAILED — killing a run that actually recovered.
        orderBy: [{ stageId: 'asc' }, { attempt: 'asc' }],
      },
    },
  });

  if (!run) return null;

  // Keyed by stageId — the graph's node id — never by the StageResult row's own cuid,
  // which the scheduler has no way to match against graph.nodes.
  const outcomes = new Map<string, StageStatus>(
    run.stages.map(stage => [stage.stageId, stage.status]),
  );

  return {
    runId,
    runStatus: run.status,
    definitionId: run.definitionId,
    environmentId: run.environmentId,
    graph: fromDefinition(run.definition.graphJson, run.definition.configJson),
    outcomes,
  };
}

/*
==============================================================================================
 * Create a data array, used to create the StageResult rows
 * Once done, make a directory for the run to work in BEFORE creating the StageResult rows
 * So that a failure in mkdir() leaves nothing to execute rather than a full set of stages that 
 * would die at spawn.
==============================================================================================
*/
export async function materializeStages(runId: string, graph: GraphJson): Promise<void> {
  // Annotated rather than inferred: without it `status: 'PENDING'` widens to string and
  // every other mismatch surfaces at the createMany call instead of at the field that
  // caused it.
  const data: Prisma.StageResultCreateManyInput[] = graph.nodes.map(node => ({
    runId,
    stageId: node.id,
    stageName: node.data.name ?? node.data.label ?? node.id,
    stageType: STAGE_TYPE_MAP[node.data.type],
    status: 'PENDING',
    command: node.data.command ?? null,
    attempt: 1,
    maxRetries: node.data.retries ?? 0,
  }));


  // `recursive` covers both a workspace root that does not exist yet and a run being materialized a second time.
  await mkdir(path.join(RUNNER_WORKSPACE_ROOT, runId), { recursive: true });

  // skipDuplicates against @@unique([runId, stageId, attempt]) is what makes a
  // redelivered run job a no-op (no operation - a call that runs, succeeds, and changes nothing) rather than a P2002.
  await prisma.stageResult.createMany({ data, skipDuplicates: true });
}



/*
==============================================================================================
 * The below functions use updateMany() instead of update() 
 * since update() throws P2025 when nothing matches, whereas updateMany() doesn't.
==============================================================================================
*/
export async function startRunIfQueued(runId: string): Promise<boolean> {
  const { count } = await prisma.pipelineRun.updateMany({
    where: { id: runId, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date() }
  });

  return count === 1;
}

export async function claimStageForQueue(runId: string, stageId: string, attempt: number): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'PENDING' },
    data: { status: 'QUEUED' }
  });

  return count === 1;
}

export async function claimStageForApproval(runId: string, stageId: string, attempt: number): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'PENDING' },
    data: { status: 'AWAITING_APPROVAL', startedAt: new Date() }
  });

  return count === 1;
}

export async function markStageRunning(runId: string, stageId: string, attempt: number): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date() }
  });

  return count === 1;
}

export async function finishStage(runId: string, stageId: string, attempt: number, terminalStatus: 'SUCCEEDED' | 'FAILED', exitCode: number | null): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'RUNNING', },
    data: { status: terminalStatus, exitCode, finishedAt: new Date() }
  });

  return count === 1;
}

export async function finalizeRun(runId: string, terminalStatus: 'SUCCEEDED' | 'FAILED'): Promise<boolean> {
  const { count } = await prisma.pipelineRun.updateMany({
    where: { id: runId, status: 'RUNNING', },
    data: { status: terminalStatus, finishedAt: new Date() }
  });

  return count === 1;
}

// Doesn't set 'QUEUED' / 'RUNNING' statuses to 'CANCELLED' -- those finish on their own
export async function cancelPendingStages(runId: string): Promise<number> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, status: 'PENDING', },
    data: { status: 'CANCELLED' }
  });

  return count;
}