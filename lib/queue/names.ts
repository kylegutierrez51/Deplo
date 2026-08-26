/*
==============================================================================================
 * The queue names both halves of the system have to agree on.
 *
 * They live in lib/ rather than in runner/queues.ts because the dependency only runs
 * one way — runner/ imports from lib/, never the reverse — so this is the only place
 * both sides can share a definition. A second copy of the string in the runner would
 * fail silently rather than loudly: the app would enqueue onto a queue nothing
 * consumes, and every run would sit at QUEUED with no error anywhere.
==============================================================================================
*/

// Run-level jobs: "make progress on run X". Produced by the app and by approvals.
export const RUN_QUEUE = 'pipeline-runs';

// Stage-level jobs: "execute stage S of run R, attempt N". Produced only by the runner.
export const STAGE_QUEUE = 'pipeline-stages';
