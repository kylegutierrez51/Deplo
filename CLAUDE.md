# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the Project

Deplo is a CI/CD pipeline management UI. It has two coexisting layers:

- **`app/`** — Next.js App Router application (the active development target)
- **`pages/`** — Static HTML/CSS prototype (design reference only; open files directly in a browser, no build step)

## Commands

```bash
npm run dev      # start Next.js dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint
npx prisma generate      # regenerate Prisma client into generated/prisma (also runs on postinstall)
npx prisma migrate dev   # create/apply a migration after editing prisma/schema.prisma
npx prisma studio        # browse the Postgres database
```

There is no test suite configured in this repo.

## Database & Auth

- `prisma/schema.prisma` defines the full Postgres schema (pipelines, runs, stages, environments, secrets, webhooks, audit log, plus NextAuth's User/Account/Session tables). The generated client outputs to `generated/prisma` (import via `@/generated/prisma/client`), not the default `node_modules/.prisma`.
- `lib/prisma.ts` exports the singleton `PrismaClient` (using `@prisma/adapter-pg`) — import this rather than instantiating a new client.
- **`lib/data/*.ts` files are currently hardcoded mock arrays, not real Prisma queries**, even though the schema they model already exists in `prisma/schema.prisma`. When wiring a page to real data, replace the mock array/functions in the matching `lib/data/<page>.ts` file with Prisma calls — don't assume the data layer is already live.
- Auth is split across two files because of the edge runtime constraint:
  - `auth.config.ts` — providers + JWT session strategy only, no Prisma adapter. Used by `proxy.ts` and by server actions in `lib/actions/auth.ts` so auth state can be checked without pulling Prisma into the edge runtime.
  - `auth.ts` — full NextAuth config with `PrismaAdapter`, used by the route handler at `app/api/auth/[...nextauth]/route.ts`.
  - `proxy.ts` is this version of Next.js's replacement for `middleware.ts` — it redirects unauthenticated requests away from any route except `/`.

## Next.js App Architecture

The app uses the App Router with file-based routing under `app/`. Each route directory contains a `page.tsx` and a co-located `[route].module.css`.

### CSS

**Design tokens and global base styles** live in `app/globals.css` under `:root`. Never hardcode color values — always use a `var(--...)` reference. New design tokens go there.

Pages that need multiple style modules merge them into a single `styles` object:

```tsx
const styles = { ...sidebarStyles, ...tableStyles, ...pageStyles };
```

**CSS Modules class naming**: hyphenated class names require bracket notation in TSX:

```tsx
className={styles['sidebar-nav']}   // hyphenated → bracket
className={styles.sidebar}          // single-word → dot
```

**Global (non-module) classes** in `app/globals.css` — `pill`, `pill--running`, `modal-overlay`, `nowrap`, etc. — are applied as plain strings, not via `styles`:

```tsx
<div className="pill pill--running">Running</div>
```

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