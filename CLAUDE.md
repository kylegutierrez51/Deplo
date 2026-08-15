# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the Project

Deplo is a CI/CD pipeline management UI: users draw a pipeline as a graph of stages in a ReactFlow editor, save it as a versioned definition, and trigger runs that execute each stage's shell command in dependency order.

- **`app/`** — Next.js App Router pages
- **`components/`** — `ui/` reusable primitives, `layout/` app chrome, `flow/` shared ReactFlow pieces, `auth/`, and one directory per feature
- **`lib/`** — data access (`lib/data`), server actions (`lib/actions`), pipeline serialization + graph validation (`lib/pipeline`), helpers (`lib/utils`), domain types
- **`runner/`** — separate Node process (BullMQ workers) that executes stages and writes results back over Prisma — see below

**Import paths**: `@/…` for anything outside your own directory, `./` for siblings. Nothing in `components/` should import from `app/`; the row components (`AuditRow`, `EnvironmentRow`, `PipelineRow`, `RunRow`) and `WebhookCardShell` still pull their styles from `app/<route>/*.module.css` and are the exception to clean up, not the pattern to copy.

## Commands

```bash
npm run dev      # start Next.js dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm run typecheck # tsc --noEmit

npm test              # Jest: unit + component (jsdom, no database)
npm run test:watch    # same, in watch mode
npm run test:coverage # same, with a coverage report
npm run test:integration # Jest against a real Postgres (see Testing below)
npm run test:e2e         # Playwright; builds and boots the app itself

npx prisma generate      # regenerate Prisma client into generated/prisma (also runs on postinstall)
npx prisma migrate dev   # create/apply a migration after editing prisma/schema.prisma
npx prisma db seed       # run prisma/seed.ts
npx prisma studio        # browse the Postgres database
```

Run a single test file or case:

```bash
npx jest lib/pipeline/validation.test.ts
npx jest -t "reports a cycle"
npx playwright test e2e/auth.spec.ts --project=anonymous
```

Required env vars (`.env`): `DATABASE_URL`, `ENCRYPTION_KEY` (hex, 32 bytes for AES-256-GCM), `AUTH_SECRET` (also used to mint the E2E session cookie), and for the runner `REDIS_HOST`, `REDIS_PORT`, `RUNNER_WORKSPACE_ROOT`.

## Testing

Three tiers, three configs. CI (`.github/workflows/ci.yml`) runs all of them plus lint/typecheck on every push and PR.

| Tier | Config | What belongs there |
|---|---|---|
| Unit + component | `jest.config.mjs` | Everything pure, plus server actions and data readers with Prisma mocked, plus React Testing Library. jsdom, no database. |
| Integration | `jest.config.integration.mjs` (`*.integration.test.ts`) | Only what a mock cannot prove: real queries, unique constraints, cascades, `ON DELETE RESTRICT`, concurrency. |
| E2E | `playwright.config.ts` (`e2e/`) | Async server components, which Jest structurally cannot render — the `?id=&mode=` modal contract, `proxy.ts`, the action → `revalidatePath` → re-render loop. |

- **Jest is wired through `next/jest`**, which supplies the SWC transform, CSS-module and `next/font` mocking, and `.env` loading. Do not add `identity-obj-proxy` or a Babel config.
- **`TZ=UTC` is pinned in `jest.config.mjs` itself**, not in a setup file — V8 caches the zone before setup files run, and `lib/utils/date.ts` formats via `toLocaleString`.
- **`ENCRYPTION_KEY` is defaulted in `test/setup-env.mjs`** (`setupFiles`, not `setupFilesAfterEnv`): `lib/utils/crypto.ts` reads it at module scope and throws when absent.
- **Mock Prisma with `jest.mock('@/lib/prisma')`** and read the instance back from `@/test/mocks/prisma` — never import `lib/__mocks__/prisma.ts` directly, because Jest gives a manual mock its own registry slot and you would stub a different object. Any test that imports from `lib/data` or `lib/actions` needs this line even if it only uses a pure helper, since `lib/prisma.ts` opens a `pg` connection at module scope.
- **Mock `next/cache` with an explicit factory**, not `jest.mock('next/cache')` — automocking loads the real module to introspect it and drags in Next's server runtime.
- **Build Prisma errors with `prismaError()` from `@/test/helpers/prisma-errors`**, which constructs them from `@/generated/prisma/runtime/library`. That is the class a real query throws; `@prisma/client/runtime/library` exports a *different* class object. See the note in that file.
- **Graph tests share the `"a b:deploy"` / `"a>b"` DSL** in `test/helpers/graph.ts`. Follow it rather than building `CustomNode[]` literals.
- **Integration tests truncate every table between cases.** `DATABASE_URL` must point at a throwaway database; `test/integration/setup.ts` refuses to run against one whose name looks like the dev database.
- **Tests pin current behaviour.** Where a test documents a defect it carries a `// TODO(bug):` comment explaining it, and E2E uses `test.fail()` so the suite goes red when the defect is fixed rather than when it is present. Do not "fix" such a test by inverting its assertion.

## Database & Auth

- `prisma/schema.prisma` defines the full Postgres schema (pipelines, definitions, runs, stages, environments, secrets, webhooks, audit log, plus NextAuth's User/Account/Session tables). The generated client outputs to `generated/prisma` (import via `@/generated/prisma` or `@/generated/prisma/client`), not the default `node_modules/.prisma`.
- `lib/prisma.ts` exports the singleton `PrismaClient` (using `@prisma/adapter-pg`) — import this rather than instantiating a new client.
- Auth is split across two files because of the edge runtime constraint:
  - `auth.config.ts` — providers + JWT session strategy only, no Prisma adapter. Used by `proxy.ts` and by server actions in `lib/actions/auth.ts` so auth state can be checked without pulling Prisma into the edge runtime.
  - `auth.ts` — full NextAuth config with `PrismaAdapter`, used by the route handler at `app/api/auth/[...nextauth]/route.ts`.
  - `proxy.ts` is this version of Next.js's replacement for `middleware.ts` — it redirects unauthenticated requests away from any route except `/`.
- Secret values are encrypted at rest with AES-256-GCM (`lib/utils/crypto.ts`). A `Secret` row stores `encryptedValue`/`iv`/`authTag`; the `Secret` type in `lib/data/secrets.ts` deliberately `Omit`s all three so a plaintext value only ever reaches the UI through `getSecretById` (`SecretDetail`).

## Data Layer Conventions

`lib/data/*.ts` (reads) and `lib/actions/*.ts` (writes) are both real Prisma code — one file per page/resource.

**Prisma enums are UPPERCASE; the UI types are lowercase.** Each data file declares an explicit `Record<PrismaEnum, DomainType>` map and translates on the way out, so a new enum member fails to compile until it is mapped:

```ts
const RUN_STATUS_MAP: Record<PrismaRunStatus, RunStatus> = { QUEUED: 'queued', /* ... */ };
```

Exported row types are built as `Omit<PrismaModel, 'status' | ...> & { status: RunStatus, ... }` — flattening relations (`pipelineName`, `triggeredBy`) rather than passing nested Prisma objects to components. Domain types (`RunStatus`, `EnvType`, `StageType`, `FormState`, …) live in `lib/types.ts`.

Server actions in `lib/actions/` are `"use server"`, take `(prevState: FormState, formData: FormData)`, return a `FormState`, and call `revalidatePath` on success. They catch `PrismaClientKnownRequestError` and translate codes into user-facing messages (`P2002` unique, `P2003` FK, `P2025` missing).

## Page & Modal Pattern

Pages are async server components that read `searchParams` and drive modals off query params (`?id=…&mode=view|edit|create`) rather than client state:

```tsx
const { mode, id } = await searchParams;
const record = id ? await getSecretById(id) : undefined;
```

The page picks a `{ mode, record }` shape and renders a `<XModalController>`, which wraps the generic `components/ui/modals/CrudModalController.tsx`. That controller owns navigation and toasts for the whole CRUD lifecycle — closing pushes back to `basePath`, saving an edit bumps a `modalKey` to remount the modal back into view mode and calls `router.refresh()` so the server component re-renders. Add new CRUD resources by supplying a `ModalComponent` to it, not by re-implementing the flow.

`app/providers.tsx` wraps the tree in `SessionProvider` + `ToastProvider`; reach toasts via `useToast()`.

## Pipeline Definitions

A saved pipeline is split into two JSON columns on `PipelineDefinition`, and `lib/pipeline/definition.ts` owns both directions:

- **`graphJson`** — structure and presentation: node ids, positions, `type`, `name`/`label`, edges. Node order is meaningful (it drives display order on the Run Detail page).
- **`configJson`** — execution config keyed by node id: `command`, `timeout`, `retries`, `env_vars`, `secrets`.

`toDefinition(nodes, edges)` serializes, `fromDefinition(graphJson, configJson)` re-merges them into the single `CustomNode.data` shape ReactFlow wants. Because Postgres `jsonb` does not preserve key order, comparisons must go through `canonicalize`/`definitionsEqual` — a plain `JSON.stringify` comparison of a fresh definition against one read back from the DB will spuriously differ.

`savePipelineDefinition` mints a new version only when the content actually changed, and retries on `P2002` since concurrent saves can compute the same `[pipelineId, version]`. Versions are monotonic and sparse — a version number is "the nth edit ever made", not a count of rows.

`lib/pipeline/validation.ts` validates a graph before a run is created: dangling edges, cycles (Kahn's algorithm, reported as a readable path), stages missing commands, and ungated deploy stages. Rule order there is load-bearing — dangling edges report alone because a phantom endpoint reads as a cycle, and a cycle returns early because the approval walk cannot trust a cyclic graph. `lib/pipeline/adjacency.ts` holds `buildMaps`, the adjacency/in-degree builder shared with the runner.

## Runner

`runner/` is a separate Node process, started by `npm run runner` (`tsx runner/index.ts`) — not by Next, and not imported from `app/`. The dependency runs one way: `runner/` imports from `lib/`, never the reverse. Two BullMQ queues connect them, named once in `lib/queue/names.ts` because both sides need the strings.

- **`pipeline-runs`** — "make progress on run X". The app produces these (`lib/queue/runs.ts`, called by `addPipelineRun`); the runner only consumes them.
- **`pipeline-stages`** — "execute stage S of run R, attempt N". Produced and consumed by the runner alone. The payload is those three ids and **nothing else**: the worker loads config from Postgres, because Redis persists to disk and decrypted secrets in `job.data` would be readable via `HGETALL`.

State lives in `StageResult` rows, not in process memory. Each turn of the loop is read → decide → write → dispatch: `db.loadRunContext` reads, the pure `scheduler.ts` decides (`readyStages`/`runOutcome` recompute from the full outcome set rather than decrementing counters), and every write is a compare-and-swap — an `updateMany` whose `where` names the expected current status, returning `count === 1` when this caller won. That boolean is an *ownership* signal, never an error: `false` means another process got there first and the correct response is to do nothing. Dropping a guard status from a `where` clause silently reintroduces double-enqueue, which is what `runner/db.test.ts` exists to catch.

The cycle is `runProcessor.advanceRun → enqueueStageJob → stageProcessor.processStage → db.finishStage → advanceRun`. All bookkeeping lives in the processor bodies, never in `worker.on('completed')` handlers — BullMQ does not await those, so a rejection there stops scheduling with no trace. Approval stages are written `AWAITING_APPROVAL` and never enqueued; `lib/actions/approvals.ts` decides them and pings the run queue to resume.

**A retry is a new row, not a re-run.** `db.openRetry` writes attempt N+1 as a fresh `PENDING` row so the failed attempt keeps its own exit code and log tail, and so every CAS still addresses exactly one row. The scheduler never learns retries exist: `loadRunContext` folds the ascending-attempt rows last-write-wins, reporting one status per `stageId` plus an `attempts` map. Read the attempt number off that map — `advanceRun` claiming a hardcoded `1` would lose the CAS against a row that is already `FAILED` and stall every retry silently. `maxRetries` counts retries *after* the first try, so `maxRetries: 2` means attempts 1–3.

**The retry row is opened *before* the failure is recorded, and that order is load-bearing.** Because the fold is last-write-wins, whatever the highest attempt says is the stage's status. Writing `FAILED` first leaves a window where that is the latest word, and with `concurrency: 5` a sibling finishing inside it calls `advanceRun`, `runOutcome` sees a failure-terminal stage, and the run is finalized `FAILED` with the retry stranded as an orphan row. Opening N+1 first means the stage reads `RUNNING → PENDING` and `runOutcome` never sees the failure; a crash between the two leaves attempt N stuck `RUNNING`, which the fold ignores and the reaper cleans up.

`runner/execute.ts` is the only place that spawns. `shell: true` makes the **shell** the child, so killing it orphans the real command — the kill must reach the process group (`detached` + negative pid on POSIX, `taskkill /T /F` on Windows), and both paths must work because the dev box is Windows and CI is `ubuntu-latest`. Note that a test using `node -e` alone cannot prove this on Linux, where the shell `exec`s a single simple command and node *is* the direct child; `execute.test.ts` spawns a real grandchild for that reason. It resolves on 'close' rather than 'exit' so the tail is not lost, and reports a non-zero exit as a result rather than throwing; it rejects only when the child could not be spawned. Children are tracked in a module-level set so `killAllChildren` can take them down at shutdown — `detached` children survive both Ctrl-C and the parent's exit otherwise.

`runner/secrets.ts` decrypts immediately before spawn and only for the run's own environment — the editor keeps stale entries for previously selected environments, so resolving the whole map would leak the wrong credentials into a run. A stage that selects secrets on a run with no environment throws rather than resolving to `{}`, since the silent version hands the command an empty `$API_KEY`. `stageProcessor` also strips `ENCRYPTION_KEY`, `DATABASE_URL` and friends from the inherited environment: a command is arbitrary user-authored shell, and that key decrypts every secret in every environment. **That denylist must grow whenever a new secret-bearing variable is added to `.env`.**

Failures split into retryable and not: a command that ran and failed (or timed out) may go differently next time, one that never started — an unresolvable secret, a child that would not spawn — will not, and burning the budget on it only buries the message. `runner/reaper.ts` runs once at boot, before `worker.run()`: it reopens and then fails rows left `RUNNING` by a dead process, then re-enters every unfinished run (`advanceRun` for `RUNNING`, `processRun` for `QUEUED`, which may never have been materialized). It **assumes a single runner process**, and it is what replaces the automatic redelivery `maxStalledCount: 0` turns off.

An abandoned `RUNNING` row is on the retryable side of that split, and `retryRunningStages` spends the budget on it: a crash says nothing about whether the command would have succeeded, so it is a stronger case for a retry than the non-zero exit that normally earns one. **It runs before `reapStaleStages`, and that ordering is the same one `processStage` observes for the same reason** — `openRetry` guards on `status: 'RUNNING'`, which is how it knows the caller still owns the attempt and where it reads `maxRetries` and the denormalized columns from, so sweeping the rows to `FAILED` first makes every call report a lost race and silently retries nothing. It also keeps the last-write-wins fold honest, since the retry row is the highest attempt from the moment it exists. The budget stays in `openRetry`; the reaper fails the row either way and only a successor row differs. The read is separate from `reapStaleStages` (`findRunningStages`) because that sweep is deliberately one statement.

`QUEUED` stage rows get their own pass (`reapQueuedStages`), because that status alone cannot say what became of the job: it may never have been enqueued, may still be waiting in Redis, or may have been active when the process died. Only the middle case recovers unaided, so each row costs one `reclaimStageJob` round trip, and the row is only reset to `PENDING` once that reports the job id is free — the id is derived from `runId/stageId/attempt`, and BullMQ answers an add on a known id by handing back the existing job and enqueuing nothing, so re-dispatching without freeing it first is a silent no-op that hangs the run.

`Queue.remove` reports success both for a job it removed and for one that was never there, and reports failure only for a job still *locked*. **`reclaimStageJob` deletes that lock and retries, and it is only safe because of when it runs.** The lock is a key with a 30s `lockDuration`, so after a crash it outlives its owner and a quick restart finds it held; deleting the lock of a job a *live* worker is processing is the corruption `Queue.remove` refuses to perform, and the only thing ruling that out is that `reapAbandonedWork` runs before `worker.run()` under the single-runner assumption. Call it from anywhere else and a running stage's keys vanish under it. A job still locked after the break is outside that model, and its row is failed rather than reset.

Remaining gap: the reaper runs only at boot, so a run stalled by a transient Postgres or Redis error stays stalled until someone restarts the runner. Every phase is individually wrapped, since all of this happens before `worker.run()` and an unhandled rejection would stop the runner from booting rather than merely leaving work unrecovered.

Not yet done: attempt ordering in `lib/data/run-detail.ts` and `lib/data/approvals.ts` (which still counts rows, so a retried stage double-counts in `stagesComplete`), auto-refresh on the run page, and navigate-to-run on trigger. Out of scope by design: cancel, webhook-triggered runs, full log storage, git checkout, multi-runner.

## CSS

**Design tokens and global base styles** live in `app/globals.css` under `:root`. Never hardcode color values — always use a `var(--...)` reference. New design tokens go there.

Pages that need multiple style modules merge them into a single `styles` object (resolved at build time, so this is not a runtime cost):

```tsx
const styles = { ...sidebarStyles, ...tableStyles, ...pageStyles };
```

**CSS Modules class naming**: hyphenated class names require bracket notation in TSX:

```tsx
className={styles['sidebar-nav']}   // hyphenated → bracket
className={styles.sidebar}          // single-word → dot
```

**Global (non-module) classes** in `app/globals.css` — `pill`, `pill--running`, `modal-overlay`, `page-content`, `nowrap`, etc. — are applied as plain strings, not via `styles`:

```tsx
<div className="pill pill--running">Running</div>
```

Status pills go through `components/ui/Pill.tsx` (`<Pill variant="succeeded" label="Succeeded" />`). Adding a variant means adding it to the `PillVariant` union *and* adding a matching `.pill--<variant>` rule in `globals.css`.

**A CSS module is owned by one component subtree.** When a parent and its children form a single visual unit, they share one module rather than one file each — `components/run-detail/run-detail-card.module.css` covers `RunDetailCard` + `RunDetailActions`, and `components/approvals/approval.module.css` covers `ApprovalCard` + `ApprovalMeta` + `ApprovalActions`. Splitting per-component across a unit is what let those directories drift into duplicated, half-dead rules. Where a component genuinely needs two modules, use the `{ ...a, ...b }` merge above.

### TypeScript for Ionicons

`declarations.d.ts` declares `<ion-icon>` as a valid JSX intrinsic element with `name`, `size`, `color`, and `src` props. Ionicons is loaded via `next/script` in `app/layout.tsx` from the unpkg CDN.

### Fonts

Loaded via `next/font/google` in `app/layout.tsx`: **Open Sans** (`--font-open-sans`) and **JetBrains Mono** (`--font-jetbrains-mono`). CSS variable names are set on the `<html>` element.

### React Compiler

`reactCompiler: true` is set in `next.config.ts`. The React Compiler handles memoization automatically — do not add `useMemo`/`useCallback` manually.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->