# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the Project

Deplo is a CI/CD pipeline management UI. It has two coexisting layers:

- **`app/`** — Next.js App Router application (the active development target)
- **`pages/`** — Static HTML/CSS prototype (design reference only; open files directly in a browser, no build step)

## Commands

```bash
npm run dev    # start Next.js dev server at localhost:3000
npm run build  # production build
npm run lint   # ESLint
```

## Next.js App Architecture

The app uses the App Router with file-based routing under `app/`. Each route directory contains a `page.tsx` and a co-located `[route].module.css`.

### CSS

**Design tokens and global base styles** live in `app/globals.css` under `:root`. Never hardcode color values — always use a `var(--...)` reference. New design tokens go there.

**Shared component modules** in `styles/*.module.css` are imported across multiple pages:

| File | Covers |
|---|---|
| `styles/sidebar.module.css` | Sidebar layout, toggle, profile popup |
| `styles/table.module.css` | Data tables |
| `styles/subheader.module.css` | Page title + action button rows |
| `styles/filters.module.css` | Search/filter bars |
| `styles/cards.module.css` | Card components |
| `styles/run-detail.module.css` | Run detail card, pipeline graph, log viewer |
| `styles/approvals.module.css` | Approvals layout |
| `styles/webhooks.module.css` | Webhooks layout |
| `styles/pipeline-editor.module.css` | Pipeline editor layout |
| `styles/pagination.module.css` | Pagination controls |
| `styles/media/*.module.css` | Responsive breakpoints per page |
| `styles/modals/*.module.css` | Modal-specific layout |

Pages that need multiple style modules merge them into a single `styles` object:

```tsx
const styles = { ...sidebarStyles, ...tableStyles, ...pageStyles };
```

This is resolved at build time (O(1) key lookups at runtime — no performance cost).

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

## Sidebar Pattern

The sidebar JSX (`.sidebar`, `.profile-options`, `#sidebarToggle` button) is copy-pasted into every page — there is no shared component. When editing the sidebar (links, structure), update all pages. `pages/components/sidebar.html` is the canonical reference shape.

## Static HTML Prototype (`pages/`)

Open `.html` files directly in a browser — no dev server, no build step. The `utils/` JS files (`toggleSidebar.js`, `sidebar-profile.js`, `toggleStageSidebar.js`) are ES modules used only by these static pages, not the Next.js app.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
