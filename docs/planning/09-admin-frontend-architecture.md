# 09. Admin / Frontend / Shared architecture (organization plan and result)

Status: implemented 2026-11-05 (Q10). This is the ownership map for `frontend/src`.

## 1. What the audit found (before)

- `src/app/admin/page-builder/` (27k lines) held the **public block library** (`packs/`, `puck.config.tsx`) and
  the public page fetchers (`store.ts`) next to the editor-only code. Every public route imported from `app/admin`.
- Public routes (`page.tsx`, `p`, `[prefix]`, `sectors`, `work`, `catalog`, `preview`, `share`, `_site`) were mixed
  with `admin` at the root of `app/`.
- Admin-only code lived in global folders: `components/{layout,command,onboarding,products,notifications,media}`,
  11 admin-only files in `components/shared`, 16 admin hooks in `hooks/`, 2 admin stores, 6 admin libs, 6 admin types.
- Public-only helpers (`lib/app-identity`, `apply-identity`, `header-overlay`, `revalidate`, `sector-metadata`) sat in the
  shared `lib/`.
- Dead files: `lib/queryClient.ts` (duplicate of the client built in `providers.tsx`), `components/shared/FileUpload.tsx`
  and `hooks/useMediaQuery.ts` (zero references, duplicates of `ImageUploadField` / `useIsMobile`), and a 0-byte
  `_tmp_22_...` file at the frontend root.
- No import cycles. Admin code never imports public route code. No `/admin` literal in public code.
- Backend: every unauthenticated route is an auth endpoint, a `/public/*` read, a form submit, a webhook, or an
  `optionalAuthenticate` route that checks `is_public` in the controller. Nothing admin-only is public.

## 2. Structure (after)

```
frontend/src/
  app/                       ROUTES ONLY (Next App Router: folders define URLs)
    layout.tsx providers.tsx globals.css th-*.css error.tsx   root shell shared by both areas
    robots.ts sitemap.ts revalidate/                          infrastructure routes
    (auth)/                  login, register, password flows (the entry to admin)
    admin/                   ADMIN routes: one page.tsx per admin URL, plus feature-local modules
    (site)/                  PUBLIC routes: /, /p/<slug>, /<key>, /preview/<token>, /sectors, /work, /catalog, /share
  admin/                     ADMIN code that is not a route
    components/ (layout, command, onboarding, products, notifications, media, shared)
    hooks/  stores/  lib/  types/
  frontend/                  PUBLIC WEBSITE code
    blocks/                  the block / section library (Puck config + packs). Admin's editor imports it too:
                             the editor edits exactly what the site renders.
    pages/                   PageRecord + public page fetchers (by slug, by site key, by preview token)
    rendering/               PageRender, SitePage (how a page becomes HTML)
    lib/                     identity/layout overlays, <head> metadata, revalidate token, sector metadata
  components/ui/             design system (shared)
  components/shared/         generic pieces both areas use (Modal, FormField, ErrorAlert, LoadingSpinner, AppImage, MediaPicker)
  components/providers/      ThemeEngineProvider (root shell)
  hooks/ lib/ stores/ types/ shared layer: axios client, auth store, utils, SEO/layout helpers, identity hook, shared types
```

## 3. Dependency rules (enforced by ESLint `no-restricted-imports`)

| Area | May import | Must NOT import |
|---|---|---|
| `src/frontend/**`, `src/app/(site)/**` | shared layer, `frontend/*` | `@/admin/*`, `@/app/admin/*` |
| shared layer (`components/ui|shared|providers`, `hooks`, `lib`, `stores`, `types`) | itself | `@/admin/*`, `@/frontend/*`, `@/app/*` |
| `src/admin/**`, `src/app/admin/**` | shared layer, `frontend/blocks`, `frontend/pages` (editor needs the block library and the page record) | `@/app/(site)/*` |

The Admin controls the website; the Frontend renders it. Rendering code never imports admin UI, and admin UI never
imports a public route.

## 4. Navigation

- Admin navigation: one definition, `admin/components/layout/AdminSidebar.tsx` (core entries) plus module-provided
  entries from the module manifests (`/api/modules/enabled`), filtered by permission and by `hidden_by_products`.
- Public navigation: the Menus module (`/api/menus/public`), the NavBar/Footer blocks and the project layout
  (`site_layouts`). No shared nav code, no `/admin` literal in public code.
- URL conflicts: `/admin` and `/login` are static segments and win over the public `[prefix]` catch-all.
  Reserved public prefixes are listed in `backend/src/modules/page-builder/validate.js` (APP_ROUTES).

## 5. Backend

Unchanged on purpose: public reads are `/public/*` sub-routes of the owning module; everything else sits behind
`authenticate` + `requirePermission`. A contract test (`backend/src/shared/modules/public-routes.contract.test.js`)
fails if a new unauthenticated route appears outside that convention.
