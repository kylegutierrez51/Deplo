import prisma from '@/lib/prisma';
import { fromDefinition } from '@/lib/pipeline/definition';
import { RUNNER_WORKSPACE_ROOT } from './connection';
import type { GraphJson, StageType } from '@/lib/types';
import type { RunStatus, StageStatus } from '@/generated/prisma';
import { Prisma, type StageType as PrismaStageType } from '@/generated/prisma/client';
import type { Outcomes } from './scheduler';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const STAGE_TYPE_MAP: Record<StageType, PrismaStageType> = {
  custom: 'CUSTOM',
  deploy: 'DEPLOY',
  approval: 'APPROVAL',
};

/** What execute() produced, in the shape finishStage writes. */
export interface StageOutcome {
  status: 'SUCCEEDED' | 'FAILED';
  exitCode: number | null;
  logSnippet: string | null;
}

interface RunContext {
  runId: string,
  runStatus: RunStatus,
  definitionId: string,
  environmentId: string | null,
  graph: GraphJson,
  outcomes: Outcomes,
  /** stageId → the attempt number of that stage's latest row. Absent = never materialized. */
  attempts: ReadonlyMap<string, number>,
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
        select: { stageId: true, status: true, attempt: true },
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

  // Built from the same ascending rows, so the survivor is the newest attempt. This is
  // what keeps retries invisible to the scheduler: it still sees one status per stage,
  // and the caller reads the attempt number off here rather than assuming 1.
  const attempts = new Map<string, number>(
    run.stages.map(stage => [stage.stageId, stage.attempt]),
  );

  return {
    runId,
    runStatus: run.status,
    definitionId: run.definitionId,
    environmentId: run.environmentId,
    graph: fromDefinition(run.definition.graphJson, run.definition.configJson),
    outcomes,
    attempts,
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

export async function finishStage(runId: string, stageId: string, attempt: number, outcome: StageOutcome): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'RUNNING', },
    data: {
      status: outcome.status,
      exitCode: outcome.exitCode,
      logSnippet: outcome.logSnippet,
      finishedAt: new Date(),
    }
  });

  return count === 1;
}


/*
==============================================================================================
 * Opens the next attempt of a stage whose command has just failed, as a new PENDING row.
 *
 * A new row rather than a mutation of the current one, so the Run Detail page can still show
 * what the earlier attempt did — its exit code and its log tail are the reason anyone looks.
 * It also keeps every compare-and-swap addressing exactly one row: `where` names an attempt,
 * so the ownership signal never blurs across two of them.
 *
 * Called while `attempt` is still RUNNING and before it is written FAILED — see the ordering
 * note in stageProcessor.processStage, which is what stops a sibling from finalizing the run
 * in between. The RUNNING guard below is the other half of that: it says the caller still
 * owns this attempt, so a row already resolved by someone else cannot be given another go.
 *
 * Returns whether a new PENDING row now exists because of this call. `false` covers both
 * "the retry budget is spent" and "another caller opened it first", and the caller wants the
 * same thing in either case — record the failure and let the scheduler decide.
 *
 * The budget is `attempt <= maxRetries`: maxRetries 2 means attempts 1, 2 and 3, so two
 * retries after the first try. maxRetries 0 — the default — never retries.
==============================================================================================
*/
export async function openRetry(runId: string, stageId: string, attempt: number): Promise<boolean> {
  const failed = await prisma.stageResult.findFirst({
    where: { runId, stageId, attempt, status: 'RUNNING' },
  });

  if (!failed || attempt > failed.maxRetries) return false;

  try {
    await prisma.stageResult.create({
      data: {
        runId,
        stageId,
        stageName: failed.stageName,
        stageType: failed.stageType,
        command: failed.command,
        maxRetries: failed.maxRetries,
        attempt: attempt + 1,
        status: 'PENDING',
      },
    });

    return true;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
}


/*
==============================================================================================
 * Fails every stage row left RUNNING by a process that is no longer alive.
 *
 * ASSUMES A SINGLE RUNNER PROCESS. Called once at boot, before either worker starts
 * consuming. With a second runner active this would fail that runner's live stages, because
 * a row gives no way to tell "abandoned by a dead process" from "owned by a living one".
 *
 * Deliberately not QUEUED: a waiting BullMQ job survives in Redis and is delivered on
 * restart, so failing that row would kill a stage that was about to run correctly. RUNNING
 * is the status with no such second chance — maxStalledCount: 0 means BullMQ will not
 * re-execute the job, so nothing else is ever going to finish that row.
 *
 * Two QUEUED rows are not recovered by anything, and both are known gaps rather than
 * oversights: one whose job was already *active* when the process died (BullMQ fails a
 * stalled job under maxStalledCount: 0, and the row was written QUEUED in the gap before
 * markStageRunning committed), and any row at all if Redis is restarted without
 * persistence. Closing them means checking the queue for each job, which needs a Redis
 * round trip per row; deferred until it actually bites.
 *
 * One statement, deliberately. Reading the ids first and then updating `id: { in: ids }`
 * needs two guards to cover the gap it opens — the id bound to skip rows that reached
 * RUNNING after the read, and a status guard to skip snapshot rows that left it — and
 * READ COMMITTED already gives both for free: the UPDATE's snapshot is taken at statement
 * start so a row that turns RUNNING later is never visited, and a row concurrently moved
 * off RUNNING has the `where` re-evaluated against the new version before it is locked.
 * The two-statement form also does not buy back the single-process assumption, since a
 * second runner's already-RUNNING stage is equally visible to the read.
==============================================================================================
*/
export async function reapStaleStages(): Promise<number> {
  const { count } = await prisma.stageResult.updateMany({
    where: { status: 'RUNNING' },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      logSnippet: 'The runner stopped while this stage was running, so its result was lost.',
    },
  });

  return count;
}

// Every run the scheduler might still owe a decision to, newest last. Used by the boot reaper.
export async function findUnfinishedRuns(): Promise<{ id: string, status: RunStatus }[]> {
  return prisma.pipelineRun.findMany({
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
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