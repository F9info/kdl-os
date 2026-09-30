# Page Builder engine (Puck) — shared library for Template Engine

A flexible, modern, drag-and-drop **visual page/site builder** (à la Wix / Lovable),
integrated for the KDL stack. Author a page once; it renders fluidly on mobile,
tablet, and desktop with no per-device code.

**No standalone admin UI.** This app is a single-site, self-hosted open-source
kit — Template Engine (`/admin/template-engine`) is the only page-editing
entry point an operator ever sees; its own page-edit route
(`frontend/src/app/admin/template-engine/edit/[id]/page.tsx`) imports the
files below directly. The previous standalone `/admin/page-builder` list +
editor + site-preview routes were a duplicate second way to edit the same
pages and have been removed — the files in this directory are library code
now, not a route tree of their own.

## Why Puck (`@puckeditor/core`)

Evaluated against Craft.js, GrapesJS, Builder.io, and Plasmic:

| Engine     | License         | React-native    | Next.js App Router                | Self-hosted / own data | Verdict                                          |
| ---------- | --------------- | --------------- | --------------------------------- | ---------------------- | ------------------------------------------------ |
| **Puck**   | MIT             | ✅              | ✅ (`Puck` + `Render`, RSC entry) | ✅                     | **Chosen**                                       |
| GrapesJS   | BSD-3           | ❌ (vanilla JS) | wrapper needed                    | ✅                     | Best when _end-customers_ need free-form styling |
| Craft.js   | MIT             | ✅              | partial                           | ✅                     | Still 0.x, infrequent maintenance                |
| Builder.io | Commercial SaaS | ✅              | ✅                                | ❌ (vendor lock-in)    | Rejected: SaaS + data exfiltration               |
| Plasmic    | Commercial/OSS  | ✅              | ✅                                | partial                | Heavier, hosted-leaning                          |

Puck is just a React component: it drops into the existing Next 15 + Tailwind app,
stores plain JSON you own (Prisma), and has zero runtime lock-in. Peer dep is
`react ^18 || ^19` — matches the repo's React 18.

## What's here

Frontend (`frontend/src/app/admin/page-builder/`)

- `puck.config.tsx` — the block library (composed from every pack under `packs/`). Shared by Template Engine's editor + the public renderer.
- `blocks-panel.tsx`, `insert-block-modal.tsx` — the editor chrome and "Insert a block" modal, mounted inside Template Engine's `<Puck>` host.
- `store.ts` — page CRUD against the real backend API (`GET/POST/PUT /api/page-builder`).
- `frontend/src/app/admin/template-engine/edit/[id]/page.tsx` — the actual editor route (imports everything above).
- `frontend/src/app/p/[slug]/page.tsx` — public responsive renderer (`<Render />`).

Backend (`backend/src/modules/page-builder/`)

- Full KDL module: `module.json`, `routes.js`, `controller.js`, `service.js`, `schema.js`.
- `backend/prisma/schema/page-builder.prisma` — `BuilderPage` model + `PageStatus` enum.
- RBAC-gated CRUD (`page-builder:view/add/edit/delete`) + activity logging + a public `GET /api/page-builder/public/:slug`.

## Notes

- The editor sets `iframe={{ enabled: false }}` so the host app's Tailwind applies inside the canvas. To re-enable Puck's iframe, inject the Tailwind stylesheet into the iframe head.
- Verified: `puck.config.tsx` + all `<Puck>`/`<Render>` prop usage type-check clean against `@puckeditor/core@0.22.2`.
