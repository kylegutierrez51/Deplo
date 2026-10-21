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
| `recovery/sweeper.ts` | Runs on a 60 second interval. Re-enters runs that stalled while the runner was alive, and fails webhook events left `PENDING` for over five minutes. |
| `setup/` | `.env` loading and the Redis connection. |

## Where to start reading

1. Start by tracing when a pipeline run is triggered (`@/lib/actions/pipelines.ts`, lines 384-395). This takes you to enqueueOrDiscardRun() in `lib/actions/run-trigger.ts`, enqueuePipelineRun() at `@/lib/queue/runs.ts`, and then `@/runner/index.ts` (lines 43-47).

2. From there, in `runProcessor.ts`, look at how a run is processed, creates its stages, and enqueues its initial stages.

3. Then look at enqueueStageJob() (`@/runner/stages/stageQueue.ts`) and the stageWorker in `@/runner/index.ts` (lines 49-53).

4. From there, in `stageProcessor.ts`, look at how a stage sets its timeout and injected secrets, and then look at execute.ts to see how it writes logs, times out or gets cancelled, and returns with an exit code.

5. Once the command finishes running and the stage returns its exit code, see how it finalizes the stage (marking it as either SUCCEEDED/FAILED/CANCELLED) and calls advanceRun(), which goes back to `step 2` and repeats the loop.

<br>

Those steps give you an overview on how the loop works. Once you feel comfortable, you can go over how the `recovery/` files work, the `stages/scrubber.ts` that masks secrets in the logs using Aho-Corasick automation, the `db.ts` queries, and how the runner starts and shuts down in `index.ts`

## GitHub Webhooks

When a run is triggered through a GitHub webhook, the runner (in ` db.ts -- loadRunContext()`) automatically appends a "Checkout" stage that runs before ANY other stage.

The "Checkout" stage runs this command: 

```bash
git init --quiet . 
  && git config remote.origin.url "${repoUrl}" 
  && git fetch --depth 1 origin ${commitSha} 
  && git checkout --force --quiet FETCH_HEAD`;
```

This initializes a repository in the deplo workspace, only fetching the code from the specified commit -- It does NOT copy an entire repo's history.

The "Checkout" stage retries twice, deleting the workspace's `.git` first before retrying.

Git runs non-interactively (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `ssh -o BatchMode=yes`), so a missing credential or an unknown SSH host key fails fast with an auth error instead of hanging until its 300 second timeout.

- `git` must be on the machine's PATH (in System Environment Variables).
- A private repository relies on the runner host's own git credentials (a credential
  manager or an SSH key). Do not put a token in the Repo URL; URLs with credentials are
  rejected when the pipeline is saved.
- The "Checkout" stage's command embeds literal values rather than `$VAR`/`%VAR%`, so it works under both
  `sh` and `cmd.exe`.

The webhook route never starts a run for a pull_request whose head repo differs from the base repo (for forked repos that send a PR to the main repo), including one whose fork has since been deleted (where GitHub reports `head.repo` as null).

### Included Environment Variables
`stageProcessor.ts` sets up to three environment variables for every stage's command, each whenever the run has a value for it:

| Variable | Set from | When it is set |
|---|---|---|
| `DEPLO_REPO_URL` | the run's `repoUrl` (snapshotted from the pipeline when the run was created; a retry keeps it) | whenever the Pipeline sets one |
| `DEPLO_COMMIT_SHA` | the run's `commitSha` | webhook runs only — `null` for a manual run |
| `DEPLO_BRANCH` | the run's `branch` | webhook runs only — `null` for a manual run |

This allows you to use these 3 environment variables in a stage's command automatically without having to type `git rev-parse HEAD` or `git remote get-url origin` whenever a GitHub webhook is triggered.

### Connecting GitHub to a local Deplo

The webhook modal shows the Deplo endpoint. When Deplo is not publicly reachable, save a smee.io channel as the webhook's Relay URL and run the `npx smee-client ...` command the modal shows. If Deplo has a public address, set `DEPLO_PUBLIC_URL` instead and the relay is not needed.

smee.io re-serializes the JSON body, so signature checks rely on GitHub's bytes surviving that round trip. If deliveries fail with 401 through smee but not directly, that is the cause.

Each is added to the environment only when its value is truthy. A stage's
own `environment variable` entry or a `secret` of the same name overrides them.

On a pull_request run, `$DEPLO_BRANCH` is the PR's own head branch (`head.ref`), not the
base branch it would merge into.

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