import { loadRunContext, markStageRunning, finishStage } from "./db";
import type { Payload } from "./stageQueue";
import { spawn } from 'node:child_process';
import path from "node:path";
import { RUNNER_WORKSPACE_ROOT } from './connection';
import { advanceRun } from "./runProcessor";

/*
==============================================================================================
 * Runs one stage and records what happened.
 *
 * Resolves whether the command succeeded or failed — a non-zero exit is a recorded
 * outcome, not a job failure, and job options set attempts: 1 because retries are ours.
 * Once markStageRunning has been won, this function owns a RUNNING row, so every path
 * out of it has to write a terminal status; returning early would strand the stage and
 * deadlock everything downstream of it.
==============================================================================================
*/

export async function processStage(job: Payload): Promise<void> {
  // Losing this CAS means the job is a redelivery, or another worker owns the row.
  const claimed = await markStageRunning(job.runId, job.stageId, job.attempt);
  if (!claimed) return;

  // The only safe early return: no run means the row went with it by cascade.
  const context = await loadRunContext(job.runId);
  if (!context) return;

  const node = context.graph.nodes.find(node => node.id === job.stageId);

  let exitCode: number | null = null;

  if (!node?.data.command) {
    console.error(`stage ${job.stageId} of run ${job.runId} has no command`);
  } else {
    const cwd = path.join(RUNNER_WORKSPACE_ROOT, job.runId);
    const env = {
      ...process.env,
      ...Object.fromEntries((node.data.env_vars ?? []).map(({ key, value }) => [key, value])),
    };

    try {
      exitCode = await execute(node.data.command, cwd, env);
    } catch (error) {
      console.error(`stage ${job.stageId} of run ${job.runId} could not be spawned:`, error);
    }
  }

  await finishStage(job.runId, job.stageId, job.attempt, exitCode === 0 ? 'SUCCEEDED' : 'FAILED', exitCode);
  await advanceRun(job.runId);
}



/* 
==============================================================================================
 * Wraps spawn in a promise so the processor can await the child. Without this the
 * processor returns the moment the listeners are registered: BullMQ would mark the job
 * complete while the command was still running, making the concurrency limit meaningless
 * and leaving the bookkeeping to fire from a detached handler nobody awaits.
==============================================================================================
 */
function execute(command: string, cwd: string, env: NodeJS.ProcessEnv): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, cwd, env });

    // Draining both pipes is not only for the logs. Nothing reads them by default, so a
    // chatty command fills the OS pipe buffer and then blocks on write, forever.
    child.stdout.on('data', chunk => console.log(`[${command}] ${chunk}`));
    child.stderr.on('data', chunk => console.error(`[${command}] ${chunk}`));

    // 'error' means the process could not be spawned at all, and 'exit' may never follow
    // it — so without this the stage would hang. An unhandled 'error' also throws.
    child.on('error', reject);

    // null when the child was killed by a signal rather than exiting on its own.
    child.on('exit', code => resolve(code));
  });
}