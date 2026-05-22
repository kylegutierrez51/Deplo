# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About the Project

Deplo is a CI/CD pipeline management UI — a static frontend (no framework, no build step, no package manager). Open any `.html` file directly in a browser to view it. There is no dev server, no compilation, and no `npm install`.

## Viewing Pages

Open files directly from the `pages/` directory in a browser. For example:
- `pages/pipeline-list.html` — main pipeline table view
- `pages/run-detail.html` — pipeline run detail with Overview and Logs tabs
- `pages/pipeline-editor.html` — pipeline editor

`pages/components/` holds isolated reference copies of components used during development (e.g., `sidebar.html`, `approval-card.html`).

## Architecture

### CSS

All CSS custom properties (colors, borders) are defined in `styles/general.css` under `:root`. Never hardcode color values in other stylesheets — always use a `var(--...)` reference. Add new design tokens there.

CSS is split by concern, not by page:

| File | Covers |
|---|---|
| `general.css` | Global reset + CSS variables |
| `sidebar.css` | Sidebar layout, toggle, profile popup, and `.page-content` margins |
| `table.css` | Data tables |
| `subheader.css` | Page title + action button rows |
| `filters.css` | Search/filter bars |
| `cards.css` | Card components |
| `run-detail.css` | Run detail card, pipeline graph, log viewer |
| `approvals.css` | Approvals-specific layout |
| `webhooks.css` | Webhooks-specific layout |
| `pipeline-editor.css` | Pipeline editor layout |

### JavaScript

Two utilities in `utils/` are included on every page with sidebars:

- `toggleSidebar.js` — toggles `.sidebar.closed` on the hamburger button click, which also slides `.page-content` via CSS sibling selectors.
- `sidebar-profile.js` — positions the `.profile-options` popup using `getBoundingClientRect()` so it stays correctly aligned even when DevTools changes the viewport height.

Both are loaded as ES modules (`type="module"`). Ionicons is loaded from the unpkg CDN.

### Sidebar Pattern

The sidebar HTML block (`.sidebar`, `.profile-options`, and the `#sidebarToggle` button) is copy-pasted into every page — there is no server-side include or JS templating. When editing the sidebar (links, structure), update it in all pages. `pages/components/sidebar.html` is the canonical reference copy.

### Fonts

Three Google Fonts families are used: **Open Sans** (body default), **JetBrains Mono** (monospace labels, subtitles, code), **Montserrat** (headings where used).
