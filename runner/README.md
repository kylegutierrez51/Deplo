# runner/

The process that actually executes pipelines. It runs separately from Next.js
(via `npm run runner`), takes work from two BullMQ queues, runs each stage's shell
command, and writes results to Postgres. The web app never imports from here.

## Main loop

```
advanceRun → enqueueStageJob → processStage → finishStage → advanceRun
 (runs/)       (stages/)         (stages/)      (db.ts)       (runs/)
```

Work reaches the runner through two queues stored in Redis. Each item in a queue is a
*job*: a small message saying what to work on. The queue names are defined in
`lib/queue/names.ts`.

**The run queue (`pipeline-runs`)** holds one kind of job: "check on this run." The job
carries only the run's id. The web app adds one when someone triggers a run or approves
or rejects an approval stage. The runner responds by looking up the run and starting any stages whose
dependencies have finished.

**The stage queue (`pipeline-stages`)** holds one kind of job: "execute this stage." The
job carries three things: the run's id, the stage's id, and the attempt number (1 for
the first try, 2 for the first retry, and so on). Only the runner adds and takes these
jobs.

A stage job never contains the command, environment variables or secrets. The runner
looks those up in Postgres when the job starts. Redis saves its jobs to disk, so a
decrypted secret put in a job would sit there where anyone with Redis access could read
it.

Each stage's progress is stored in Postgres, in the `StageResult` table: one row per
attempt of each stage, holding its status (`PENDING`, `QUEUED`, `RUNNING`, `SUCCEEDED`,
`FAILED`, and so on), exit code and logs. Every time a run job arrives or a stage
finishes, the runner reads that run's rows, works out which stages can start now, updates their status, and
adds a stage job for each one.

The runner keeps nothing about a run in memory; everything it knows is in those rows.
That is why a runner that crashes or restarts can pick up where it left off.

## Layout

| Path | What it is |
|---|---|
| `index.ts` | Entry point. Creates both workers (the two BullMQ queues), runs recovery, handles shutdown. |
| `db.ts` | Every Postgres read and write the runner makes. |
| `runs/runProcessor.ts` | `processRun` / `advanceRun`: the read → decide → write → dispatch turn. |
| `runs/scheduler.ts` | checks which stages are ready, and whether the run is done. |
| `stages/stageQueue.ts` | Adding stage jobs to Redis (and reclaiming them during recovery). |
| `stages/stageProcessor.ts` | One attempt of one stage: claim, resolve secrets, run, finish or retry. |
| `stages/execute.ts` | Spawns the command. The only place a process is started. |
| `stages/secrets.ts` | Decrypts a stage's secrets just before it runs. |
| `stages/scrubber.ts` | Masks secret values in log output. |
| `recovery/reaper.ts` | Runs once at boot. Cleans up after a runner that died mid-work. |
| `recovery/sweeper.ts` | Runs on a 60 second interval. Re-enters runs that stalled while the runner was alive. |
| `setup/` | `.env` loading and the Redis connection. |

## Where to start reading

1. Start by tracing when a pipeline run is triggered (`@/lib/actions/pipelines.ts`, lines 369-380). This takes you to enqueueOrDiscardRun() in `lib/actions/run-trigger.ts`, enqueuePipelineRun() at `@/lib/queue/runs.ts`, and then `@/runner/index.ts` (lines 43-47).

2. From there, in `runProcessor.ts`, look at how a run is processed, creates its stages, and enqueues its initial stages.

3. Then look at enqueueStageJob() (`@/runner/stages/stageQueue.ts`) and the stageWorker in `@/runner/index.ts` (lines 49-53).

4. From there, in `stageProcessor.ts`, look at how a stage sets its timeout and injected secrets, and then look at execute.ts to see how it writes logs, times out or gets cancelled, and returns with an exit code.

5. Once the command finishes running and the stage returns its exit code, see how it finalizes the stage (marking it as either SUCCEEDED/FAILED/CANCELLED) and calls advanceRun(), which goes back to `step 2` and repeats the loop.

<br>

Those steps give you an overview on how the loop works. Once you feel comfortable, you can go over how the `recovery/` files work, the `stages/scrubber.ts` that masks secrets in the logs using Aho-Corasick automation, the `db.ts` queries, and how the runner starts and shuts down in `index.ts`

## Rules that fail silently if broken

- **Every write in `db.ts` is a compare-and-swap.** It's an `updateMany` whose `where`
  names the status the caller expects. If it returns `false`, it means another caller 
  got there first and updated the data in the database, not that something went wrong.
- **A retry is a new row.** Attempt N+1 is a fresh `PENDING` row, opened *before*
  attempt N is marked `FAILED`. Swapping that order can finalize a run as failed while
  its retry is still pending.
- **Only `stages/execute.ts` spawns processes**, and it kills the whole process group,
  not just the shell. It has to work on both Windows (dev) and Linux (CI).
- **Everything that happens after a stage runs lives inside `processStage` /
  `processRun`, never in a `worker.on('completed' | 'failed')` handler.** That means
  recording the result (`finishStage`), opening a retry (`openRetry`) if necessary, and calling
  `advanceRun` to start the next stages. BullMQ awaits the processor, so if one of those
  calls throws there, the job is marked failed and retried. It does not await event
  handlers: the job is already `completed` and the handler's promise is dropped. A
  rejection there either crashes the whole runner (an unhandled rejection) or, if
  caught, is swallowed and the run stops advancing.
- **The reaper is only safe before the workers start.** `main()` in `index.ts` awaits it
  before calling `runWorker.run()` / `stageWorker.run()`, and `autorun: false` is what
  stops them taking jobs any earlier. It deletes BullMQ locks and fails
  `RUNNING` rows, which would break work a live worker is doing. The sweeper is the
  subset that is safe to repeat.
- **If you add a secret-bearing variable to `.env`**, add it to the denylist in
  `stages/stageProcessor.ts` too, or every stage's command can read it.

## Extra Notes

**SINGLE RUNNER ASSUMPTION** refers to the idea of having only 1 runner active. Deplo is not intended to run with 2 or more runners.