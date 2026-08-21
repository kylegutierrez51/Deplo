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
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
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
        // Ensures that 'outcomes' and 'attempts' only include the stage with the highest attempt
        // by sorting from lowest -> highest attempt for each stage.
        orderBy: [{ stageId: 'asc' }, { attempt: 'asc' }],
      },
    },
  });

  if (!run) return null;

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

export async function recordStageProgress(
  runId: string,
  stageId: string,
  attempt: number,
  logSnippet: string,
): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'RUNNING' },
    data: { logSnippet },
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
 * QUEUED rows are handled separately, by the reaper's own pass over findQueuedStages —
 * they need a Redis round trip per row that this statement cannot make.
 *
 * Use Raw SQL since the note variable has to be *appended* to
 * each row's own logSnippet rather than assigned over it: recordStageProgress has been
 * saving that stage's output every couple of seconds precisely so it survives a crash, and
 * overwriting it here would discard the only record of how far the command got, on exactly
 * the rows someone opens the run to read. Prisma's updateMany cannot express that, because
 * a `data` value is a constant where this needs an expression over the existing column.
 * Going through the client would mean one update per row and the gap described above, so
 * the statement moves to SQL rather than the sweep losing its single-statement property.
==============================================================================================
*/
export async function reapStaleStages(): Promise<number> {
  const note = 'The runner stopped while this stage was running, so its result was lost.';

  /*
   * CHR(10) - equivalent to a newline
   *
   * NOW() AT TIME ZONE 'UTC' rather than NOW(): finishedAt is TIMESTAMP(3) without a zone
   * and Prisma stores UTC in it, so a bare NOW() would land the session's local time in a
   * column every other writer fills with UTC.
   * 
   * The ELSE concatenates '\n{note}' to logSnippet
   */
  return await prisma.$executeRaw`
    UPDATE "stage_results"
    SET "status" = 'FAILED'::"StageStatus",
        "finishedAt" = NOW() AT TIME ZONE 'UTC',
        "logSnippet" = CASE
          WHEN "logSnippet" IS NULL OR "logSnippet" = '' THEN ${note}::text
          ELSE "logSnippet" || CHR(10) || ${note}::text
        END
    WHERE "status" = 'RUNNING'::"StageStatus"
  `;
}

// Every run the scheduler might still owe a decision to, newest last. Used by the boot reaper.
export async function findUnfinishedRuns(): Promise<{ id: string, status: RunStatus }[]> {
  return await prisma.pipelineRun.findMany({
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findRunningStages(): Promise<{ stageId: string, runId: string, attempt: number }[]> {
  return await prisma.stageResult.findMany({
    where: { status: 'RUNNING' },
    select: { stageId: true, runId: true, attempt: true },
  });
}

export async function findQueuedStages(): Promise<{ stageId: string, runId: string, attempt: number }[]> {
  return await prisma.stageResult.findMany({
    where: { status: 'QUEUED' },
    select: { stageId: true, runId: true, attempt: true },
  });
}

export async function updateQueuedToPending(runId: string, stageId: string, attempt: number): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'QUEUED' },
    data: { status: 'PENDING'}
  });

  return count > 0;
}

/*
==============================================================================================
 * Fails a QUEUED row whose BullMQ job could not be taken back.
 *
 * The reaper resets a queued stage to PENDING so advanceRun can dispatch it again, which
 * only works once the old job is gone from Redis — the job id is derived from
 * runId/stageId/attempt, and BullMQ silently returns the existing job rather than enqueuing
 * when that id is already in the keyspace. A job still locked by the dead process cannot be
 * removed, so re-enqueuing would be a no-op and the row would sit QUEUED forever with
 * nothing scheduled to move it.
 *
 * That job is not coming back either: maxStalledCount: 0 means the stalled checker stamps a
 * failure reason on it and it fails without ever entering the processor. So the stage really
 * did fail, and saying so out loud is what turns a silently hung run into one that finalizes
 * and can be triggered again.
==============================================================================================
*/
export async function failQueuedStage(runId: string, stageId: string, attempt: number): Promise<boolean> {
  const { count } = await prisma.stageResult.updateMany({
    where: { runId, stageId, attempt, status: 'QUEUED' },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      logSnippet: 'The runner stopped while this stage was queued, and its job could not be recovered.',
    },
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

export async function isRunCancelled(runId: string): Promise<boolean> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });

  return run?.status === 'CANCELLED';
}

/*
==============================================================================================
 * Closes out every stage still open on a run that was cancelled, for the boot reaper.
 *
 * cancelRun sweeps the stages it can reach and leaves the RUNNING one to the runner, which
 * kills the command and writes the row itself. A runner that died in between leaves that row
 * RUNNING on a CANCELLED run — and retryRunningStages would hand it a fresh PENDING attempt
 * that nothing will ever dispatch, since advanceRun early-returns on a cancelled run.
 *
 * Runs first in reapAbandonedWork so these rows are already terminal by the time the
 * RUNNING and QUEUED passes read them, which is what keeps those passes free of any
 * special-casing for cancellation. Also repairs the window between cancelRun's two writes.
==============================================================================================
*/
export async function cancelOrphanedStages(): Promise<number> {
  const { count } = await prisma.stageResult.updateMany({
    where: {
      run: { status: 'CANCELLED' },
      status: { in: ['PENDING', 'QUEUED', 'RUNNING', 'AWAITING_APPROVAL'] },
    },
    data: { status: 'CANCELLED', finishedAt: new Date() },
  });

  return count;
}
