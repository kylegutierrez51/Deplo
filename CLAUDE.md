# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the Project

Deplo is a CI/CD pipeline management UI: users draw a pipeline as a graph of stages in a ReactFlow editor, save it as a versioned definition, and trigger runs that execute each stage's shell command in dependency order.

- **`app/`** — Next.js App Router pages
- **`components/`** — `ui/` reusable primitives, `layout/` app chrome, `flow/` shared ReactFlow pieces, `auth/`, and one directory per feature
- **`lib/`** — data access (`lib/data`), server actions (`lib/actions`), pipeline serialization + graph validation (`lib/pipeline`), helpers (`lib/utils`), domain types
- **`runner/`** — BullMQ worker that actually executes stages (standalone, not yet wired to the app — see below)

**Import paths**: `@/…` for anything outside your own directory, `./` for siblings. Nothing in `components/` should import from `app/`; the row components (`AuditRow`, `EnvironmentRow`, `PipelineRow`, `RunRow`) and `WebhookCardShell` still pull their styles from `app/<route>/*.module.css` and are the exception to clean up, not the pattern to copy.

## Commands

```bash
npm run dev      # start Next.js dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm test         # node:test suite over lib/**/*.test.ts (via tsx)

npx prisma generate      # regenerate Prisma client into generated/prisma (also runs on postinstall)
npx prisma migrate dev   # create/apply a migration after editing prisma/schema.prisma
npx prisma db seed       # run prisma/seed.ts
npx prisma studio        # browse the Postgres database
```

Run a single test file or case:

```bash
node --import tsx --test lib/pipeline/graph.test.ts
node --import tsx --test --test-name-pattern "reports a cycle" "lib/**/*.test.ts"
```

Required env vars (`.env`): `DATABASE_URL`, `ENCRYPTION_KEY` (hex, 32 bytes for AES-256-GCM), and for the runner `REDIS_HOST`, `REDIS_PORT`, `CWD`.

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

`lib/pipeline/graph.ts` validates a graph before a run is created: dangling edges, cycles (Kahn's algorithm, reported as a readable path), stages missing commands, and ungated deploy stages. This is the one module with test coverage (`lib/pipeline/graph.test.ts`) — its helpers write graphs compactly as `"a b:deploy"` / `"a>b"` specs; follow that style when adding cases. `lib/pipeline/adjacency.ts` holds `buildMaps`, the adjacency/in-degree builder shared with the runner.

## Runner

`runner/` is a standalone BullMQ worker, **not yet connected to the app** — `runner/bullmq.ts` calls `triggerRun()` at module load using the hardcoded `runner/sample.ts` fixtures, and nothing in `app/` imports it. The dependency runs one way — `runner/` imports from `lib/` (`runner/runState.ts` uses `buildMaps` from `lib/pipeline/adjacency.ts`), never the reverse. Treat wiring it to real pipelines as unfinished work.

How it executes a run: `runState.ts` holds an in-memory `Map` of runId → dependency graph (adjacency + in-degree). `startRun` returns the stages with in-degree 0, those get enqueued, and each `completed` event calls `completeStage` to decrement dependents and enqueue whatever just became ready. State is per-run, so concurrent runs don't interfere — but it lives in process memory and does not survive a restart. Stages run via `spawn(command, { shell: true })` with env vars merged into `process.env`; approval stages have no command and are skipped by `enqueueReadyStages`.

Note `runner/types.ts` defines its own `StageConfig`/`ConfigJson` shapes (`env` as an array, `secrets` as `string[]`) that differ from the editor's in `lib/types.ts` (`env_vars`, `secrets` keyed by environment id) — they are not interchangeable.

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