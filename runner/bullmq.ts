import './env';
import { connection, RUNNER_WORKSPACE_ROOT } from './connection';
import { Queue, Worker } from "bullmq";
import { spawn } from 'child_process';
import { randomUUID } from 'node:crypto';
import type { CompressedStagePayload, ConfigJson } from "./types";

import { startRun, completeStage, failRun } from './runState';
import { graphJson, configJson } from './sample';

const stageQueue = new Queue("pipeline-stages", { connection });

async function enqueueStage(payload: CompressedStagePayload) {
  await stageQueue.add(`stage-${payload.stageId}`, payload, {
    jobId: `${payload.runId}:${payload.stageId}:${payload.attempt}`,
  });
}

async function enqueueReadyStages(runId: string, stageIds: string[], config: ConfigJson) {
  for (const stageId of stageIds) {
    const stageConfig = config[stageId];
    if (!stageConfig.command) {
      console.log(`${stageId} has no command (likely an approval gate) — skipping auto-enqueue`);
      continue;
    }

    await enqueueStage({
      runId,
      stageId,
      attempt: 0,
      command: stageConfig.command,
      cwd: RUNNER_WORKSPACE_ROOT,
      timeout: stageConfig.timeout,
      retries: stageConfig.retries,
      env: stageConfig.env,
      secrets: stageConfig.secrets,
    });
  }
}

const worker = new Worker<CompressedStagePayload>("pipeline-stages",
  async (job) => {
    return new Promise<void>((resolve, reject) => {
      const env = { ...process.env, ...Object.fromEntries(job.data.env.map(({ key, value }) => [key, value])) };
      const child = spawn(job.data.command, { shell: true, cwd: job.data.cwd, env });

      child.stdout.on('data', (chunk) => {
        // Data chunks arrive as raw Buffers; convert to string to read
        console.log(`stdout chunk:\n${chunk.toString()}`);
      });

      child.stderr.on('data', (chunk) => {
        console.error(`stderr chunk: ${chunk.toString()}`);
      });

      child.on('spawn', () => {
        console.log('Subprocess spawned!');
        console.log(`Subprocess child PID: ${child.pid}`);
      })

      child.on('error', (err) => {
        console.log(`${err}`)
        reject(err);
      })

      child.on('exit', (code) => {
        console.log(`Subprocess ended with exit code: ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Subprocess exited with code ${code}`));
        }
      });
    });
  }, { connection, concurrency: 5 }
)


worker.on('completed', async (job) => {
  console.log(job);
  console.log(`${job.id} has completed!`);

  const result = completeStage(job.data.runId, job.data.stageId);
  if (result) {
    await enqueueReadyStages(job.data.runId, result.ready, result.config);
  }
});

worker.on('failed', async (job, err) => {
  console.log(`${job?.id ?? 'unknown job'} has failed with ${err.message}!`);
  if (!job) return;

  if (job.data.attempt < job.data.retries) {
    await enqueueStage({ ...job.data, attempt: job.data.attempt++ });
  } else {
    console.error(`${job.data.stageId} exhausted retries for run ${job.data.runId}`);
    failRun(job.data.runId);
  }
});

worker.on('error', (err) => {
  // log the error -- avoids NodeJS from raising an unhandled exception when an error occurs
  console.error(err);
});


async function _triggerRun() {
  const runId = randomUUID();
  const readyStages = startRun(runId, graphJson, configJson);
  await enqueueReadyStages(runId, readyStages, configJson);
}