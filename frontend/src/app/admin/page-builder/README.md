# Page Builder module (Puck) — proof-of-concept

A flexible, modern, drag-and-drop **visual page/site builder** (à la Wix / Lovable),
integrated for the KDL stack. Author a page once; it renders fluidly on mobile,
tablet, and desktop with no per-device code.

## Why Puck (`@puckeditor/core`)

Evaluated against Craft.js, GrapesJS, Builder.io, and Plasmic:

| Engine | License | React-native | Next.js App Router | Self-hosted / own data | Verdict |
|--------|---------|--------------|--------------------|------------------------|---------|
| **Puck** | MIT | ✅ | ✅ (`Puck` + `Render`, RSC entry) | ✅ | **Chosen** |
| GrapesJS | BSD-3 | ❌ (vanilla JS) | wrapper needed | ✅ | Best when *end-customers* need free-form styling |
| Craft.js | MIT | ✅ | partial | ✅ | Still 0.x, infrequent maintenance |
| Builder.io | Commercial SaaS | ✅ | ✅ | ❌ (vendor lock-in) | Rejected: SaaS + data exfiltration |
| Plasmic | Commercial/OSS | ✅ | ✅ | partial | Heavier, hosted-leaning |

Puck is just a React component: it drops into the existing Next 15 + Tailwind app,
stores plain JSON you own (Prisma), and has zero runtime lock-in. Peer dep is
`react ^18 || ^19` — matches the repo's React 18.

## What's in the POC

Frontend (`frontend/src/app/admin/page-builder/`)
- `puck.config.tsx` — responsive block library (Hero, Heading, Text, Button, Image, Spacer, Columns, Section). Shared by editor + renderer.
- `page.tsx` — page list / create.
- `[id]/page.tsx` — the visual editor (`<Puck />`) with a built-in **mobile / tablet / desktop viewport switcher**.
- `store.ts` — POC persistence (localStorage) so the builder works with no backend yet.
- `frontend/src/app/p/[slug]/page.tsx` — public responsive renderer (`<Render />`).

Backend (`backend/src/modules/page-builder/`)
- Full KDL module: `module.json`, `routes.js`, `controller.js`, `service.js`, `schema.js`.
- `backend/prisma/schema/page-builder.prisma` — `BuilderPage` model + `PageStatus` enum.
- RBAC-gated CRUD (`page-builder:view/add/edit/delete`) + activity logging + a public `GET /api/page-builder/public/:slug`.

## Run it

```bash
# 1. Install the engine (already added to frontend/package.json)
cd frontend && pnpm install

# 2. Create the table (infra is already up)
cd ../backend && pnpm prisma migrate dev --name page_builder

# 3. Start the app, then open:
#    /admin/page-builder   → create + edit pages
#    /p/<slug>             → public responsive view
```

## Promote to production (swap localStorage → API)

The frontend `store.ts` functions map 1:1 onto the backend endpoints — replace the
localStorage body with `api` (lib/axios) calls; the Puck `Data` shape is identical:

- `listPages()`  → `GET /api/page-builder`
- `getPage(id)`  → `GET /api/page-builder/:id`
- `createPage()` → `POST /api/page-builder`
- `savePage()`   → `PUT /api/page-builder/:id`  (send `status: 'PUBLISHED'` to publish)

Then convert `/p/[slug]/page.tsx` into a server component that fetches from
`GET /api/page-builder/public/:slug` and passes `data` straight to `<Render />`.

## Notes
- The editor sets `iframe={{ enabled: false }}` so the host app's Tailwind applies inside the canvas. To re-enable Puck's iframe, inject the Tailwind stylesheet into the iframe head.
- Verified: `puck.config.tsx` + all `<Puck>`/`<Render>` prop usage type-check clean against `@puckeditor/core@0.22.2`.
