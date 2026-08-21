import {
  loadRunContext, markStageRunning, finishStage, openRetry, recordStageProgress,
  isRunCancelled,
  type StageOutcome,
} from "./db";
import type { Payload } from "./stageQueue";
import path from "node:path";
import { RUNNER_WORKSPACE_ROOT } from './connection';
import { advanceRun } from "./runProcessor";
import { execute } from "./execute";
import { resolveSecrets } from "./secrets";
import type { CustomNode } from "@/lib/types";
import { CANCELLED_NOTE } from "@/lib/stage-notes";


const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 1800s

const CANCEL_POLL_MS = 2_000;

/*
 * Stripped from the environment every command inherits.
 *
 * The child would otherwise get the runner's own process.env, which holds ENCRYPTION_KEY —
 * the AES-256-GCM key for every secret in every environment — and DATABASE_URL. A pipeline
 * command is arbitrary user-authored shell, so `echo $ENCRYPTION_KEY` would hand back the
 * means to decrypt everything, making the per-environment scoping in secrets.ts pointless.
 */
const WITHHELD_FROM_COMMANDS = [
  'ENCRYPTION_KEY', 'DATABASE_URL', 'AUTH_SECRET',
  'NEXTAUTH_SECRET', 'NEXTAUTH_URL',
  'REDIS_HOST', 'REDIS_PORT', "NODE_ENV"
];

/*
==============================================================================================
 * Runs one attempt of one stage and records what happened.
 *
 * Once markStageRunning has been won, this function owns a RUNNING row, so every path out of
 * it has to write a terminal status — returning early would strand the stage and deadlock
 * everything downstream of it. That is why the work below is funnelled through
 * attemptStage, which reports failures instead of throwing them.
 *
 * A non-zero exit is a recorded outcome, not a job failure; job options set attempts: 1
 * because retries are ours, written as attempt+1 rows.
==============================================================================================
*/
export async function processStage(job: Payload): Promise<void> {
  // If claimed is false, then the job is a redelivery or another worker owns the row.
  const claimed = await markStageRunning(job.runId, job.stageId, job.attempt);
  if (!claimed) return;

  // The only safe early return: no run means the row went with it by cascade.
  const context = await loadRunContext(job.runId);
  if (!context) return;

  const node = context.graph.nodes.find(node => node.id === job.stageId);
  const { outcome, retryable } = await attemptStage(node, context.environmentId, job);

  if (outcome.status === 'FAILED' && retryable) {
    await openRetry(job.runId, job.stageId, job.attempt);
  }

  await finishStage(job.runId, job.stageId, job.attempt, outcome);
  await advanceRun(job.runId);
}

interface StageAttempt {
  outcome: StageOutcome;
  retryable: boolean;
}

/*
==============================================================================================
 * Everything between owning the row and knowing the result. Never throws.
 *
 * `retryable` is the distinction between "the command ran and did not like what it found"
 * and "we never got as far as running it". A non-zero exit or a timeout may well go
 * differently next time, which is what the retry count was configured for. A secret that no
 * longer exists or a workspace that has vanished will not fix itself, and burning ten
 * attempts on it only buries the real message further up the Run Detail page.
==============================================================================================
*/
async function attemptStage(
  node: CustomNode | undefined,
  environmentId: string | null,
  job: Payload,
): Promise<StageAttempt> {
  const command = node?.data.command;

  if (!command) {
    return {
      outcome: { status: 'FAILED', exitCode: null, logSnippet: `Stage "${job.stageId}" has no command to run.` },
      retryable: false,
    };
  }

  const timeoutMs = node.data.timeout && node.data.timeout > 0
    ? node.data.timeout * 1000
    : DEFAULT_TIMEOUT_MS;

  try {
    // Resolved here rather than carried on the job: Redis persists to disk, so a decrypted
    // value in job.data is a credential in an AOF file.
    const secrets = await resolveSecrets(node.data.secrets ?? {}, environmentId);

    const inherited = { ...process.env };
    for (const key of WITHHELD_FROM_COMMANDS) delete inherited[key];

    const env = {
      ...inherited,
      ...Object.fromEntries((node.data.env_vars ?? []).map(({ key, value }) => [key, value])),

      // Last, so a selected secret wins a name collision with a plain env var.
      ...secrets,
    };

    let savingProgress = false;


    const abort = new AbortController();

    const cancelWatch = setInterval(() => {
      isRunCancelled(job.runId)
        .then(cancelled => { if (cancelled) abort.abort(); })
        .catch(error => console.error(
          `stage ${job.stageId} of run ${job.runId}: cancel check failed:`,
          error instanceof Error ? error.message : error,
        ));
    }, CANCEL_POLL_MS);

    cancelWatch.unref(); // same reasoning as the timers in execute.ts

    let result;
    try {
      result = await execute({
        command,
        cwd: path.join(RUNNER_WORKSPACE_ROOT, job.runId),
        env,
        timeoutMs,
        signal: abort.signal,
        onSnapshot: tail => {
          if (savingProgress) return;
          savingProgress = true;

          recordStageProgress(job.runId, job.stageId, job.attempt, tail)
            .catch(error => console.error(
              `stage ${job.stageId} of run ${job.runId}: log progress not saved:`,
              error instanceof Error ? error.message : error,
            ))
            .finally(() => { savingProgress = false; });
        },
      });
    } finally {
      clearInterval(cancelWatch);
    }

    if (result.cancelled) {
      return {
        outcome: {
          status: 'CANCELLED',
          exitCode: result.exitCode,
          logSnippet: `${result.logSnippet}\n${CANCELLED_NOTE}`.trim(),
        },
        retryable: false,
      };
    }

    return {
      outcome: {
        status: result.exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
        exitCode: result.exitCode,
        // A killed command's own output rarely says why it stopped, and the exit code is
        // null on POSIX, so without this line a timeout is indistinguishable from a crash.
        logSnippet: result.timedOut
          ? `${result.logSnippet}\n[stage exceeded its ${timeoutMs / 1000}s timeout and was terminated]`.trim()
          : result.logSnippet,
      },
      retryable: true,
    };
  } catch (error: unknown) {
    // Unresolvable secrets and a child that could not be spawned both land here.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`stage ${job.stageId} of run ${job.runId} could not run:`, message);

    return {
      outcome: { status: 'FAILED', exitCode: null, logSnippet: message },
      retryable: false,
    };
  }
}
