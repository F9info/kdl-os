# Template Engine — Website/CMS Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Template Engine Studio's WEBSITE stage a real design surface — a page-list/template-picker input step, project-scoped page storage, an inline Puck editor, and SEO/sitemap output — replacing today's "click advance, get a download link" wrapper.

**Architecture:** `page-builder`'s `BuilderPage` becomes project-scoped (new `project_id` FK). The Studio `websiteDriver` gains a body payload (`{ pages: [{ key, title, templateId }] }`) threaded from the advance endpoint through to the driver, replacing its hardcoded 3-page seed. Starter page content lives backend-side (`page-builder/starters.js`, plain JSON `Data` trees — no JSX, so no frontend/backend duplication). The frontend's Puck editor wiring is extracted into a shared `PuckPageEditor` component, reused by both the standalone `/admin/page-builder/[id]` screen and a new inline tab view inside `WebsiteStage`.

**Tech Stack:** Node 20 + Express 5 + Prisma 6 (backend), Next.js 15 + TypeScript 5 + `@puckeditor/core` + TanStack Query (frontend), Vitest (both), Zod validation.

**Spec:** `docs/superpowers/specs/2026-08-24-template-engine-website-cms-design.md`

---

## Pre-flight — read before starting

- `backend/src/modules/page-builder/service.js` (71 lines) — current global CRUD, no project scoping.
- `backend/prisma/schema/page-builder.prisma` — `BuilderPage` model, no `project_id`.
- `backend/src/modules/template-engine/drivers/index.js` — `websiteDriver`, hardcoded `WEBSITE_SEED_PAGES`.
- `backend/src/modules/template-engine/service.js` — `advanceStage(runId, stageSlug, userId, projectId)`, no body param today.
- `backend/src/modules/template-engine/schema.js` — `advanceStageSchema` validates an optional body but nothing reads it.
- `frontend/src/app/admin/page-builder/puck.config.tsx` — composes `general`/`construction`/`medical` packs; `root.fields = { title }`.
- `frontend/src/app/admin/page-builder/[id]/page.tsx` — the Puck editor to extract.
- `frontend/src/app/admin/template-engine/_components/stages/WebsiteStage.tsx` — the stage to rewrite.
- `frontend/src/hooks/useTemplateEngine.ts` — `useAdvanceStage` posts `undefined` as body today.
- `backend/prisma/migrations/20260824000001_add_project_members/migration.sql` — house style for hand-written migration SQL (KDL-ticket header comment, guarded/idempotent backfill).

**Deviations from the spec doc** (discovered during planning, spec is not updated — this plan is authoritative on these two points):
1. Starter templates are defined **backend-side** (`page-builder/starters.js`, plain JSON), not as frontend `packs/*/starters.ts`. Puck `Data` is plain JSON with no JSX, and the driver (Node/Express) that seeds pages cannot import frontend TSX — so the canonical copy lives where it's consumed (the driver), and the frontend template picker just lists `{id, label}` options from a new endpoint.
2. The standalone `/admin/page-builder` screen has **no project-selector UI today** (confirmed: `grep -rl "X-Project-Id" frontend/src` returns only `useTemplateEngine.ts`). Rather than redesign that screen's navigation (explicitly Phase 2 scope per the spec), page-builder routes fall back to the seeded Default Project when no `X-Project-Id` header is sent, instead of the stricter shared `requireProject()` which 400s on a missing header. This is a new small module-local middleware, not a change to the shared one (three other modules depend on its strict behavior).

---

### Task 1: `BuilderPage.project_id` migration

**Files:**
- Modify: `backend/prisma/schema/page-builder.prisma`
- Create: `backend/prisma/migrations/20260824010000_add_project_id_to_builder_pages/migration.sql`

- [ ] **Step 1: Edit the Prisma schema**

In `backend/prisma/schema/page-builder.prisma`, add the field and relation:

```prisma
model BuilderPage {
  id         String     @id @default(cuid())
  slug       String     @unique
  title      String
  status     PageStatus @default(DRAFT)
  data       Json
  project_id String
  created_by String?
  deleted_at DateTime?
  created_at DateTime   @default(now())
  updated_at DateTime   @updatedAt

  project    Project    @relation(fields: [project_id], references: [id])

  @@index([status])
  @@index([project_id])
  @@map("builder_pages")
}
```

Open `backend/prisma/schema/projects.prisma` and add the back-relation so `prisma generate` doesn't error on a one-sided relation. Find the `Project` model's existing back-relations (e.g. `credit_balance CreditBalance?`) and add a line after them:

```prisma
  builder_pages  BuilderPage[]
```

- [ ] **Step 2: Write the migration SQL by hand**

Create the directory and file:

```bash
mkdir -p "backend/prisma/migrations/20260824010000_add_project_id_to_builder_pages"
```

`backend/prisma/migrations/20260824010000_add_project_id_to_builder_pages/migration.sql`:

```sql
-- Migration: add_project_id_to_builder_pages (KDL-558 Phase 1)
-- BuilderPage rows were previously unscoped (pseudo-namespaced via slug prefix
-- te-<runId>-<key> by the template-engine website driver). This adds a real
-- project_id FK so page-list, SEO, and sitemap generation can be scoped
-- per-project instead of string-matching slugs.
--
-- Backfill: any pre-existing row is assigned to the seeded Default Project
-- (is_default = true), which is already the org-wide fallback used elsewhere
-- (see is_shared on projects, KDL-635). This repo is pre-production — there is
-- no real multi-tenant page-builder data yet to reconcile more carefully.

ALTER TABLE "builder_pages" ADD COLUMN "project_id" TEXT;

UPDATE "builder_pages"
SET    "project_id" = (SELECT "id" FROM "projects" WHERE "is_default" = true LIMIT 1)
WHERE  "project_id" IS NULL;

ALTER TABLE "builder_pages" ALTER COLUMN "project_id" SET NOT NULL;

ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "builder_pages_project_id_idx" ON "builder_pages"("project_id");
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run:
```bash
cd backend && npx prisma migrate dev
```
Expected: prisma detects the new migration folder, applies it, prints `Your database is now in sync with your schema.`, then regenerates the client (via the `postinstall`/`db:generate` hook).

If prisma instead tries to generate a *second*, auto-diffed migration (because it doesn't recognize the hand-written one as applied), stop and run `npx prisma migrate resolve --applied 20260824010000_add_project_id_to_builder_pages` first, then re-run `npx prisma migrate dev`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema/page-builder.prisma backend/prisma/schema/projects.prisma backend/prisma/migrations/20260824010000_add_project_id_to_builder_pages
git commit -m "feat(page-builder): add project_id to BuilderPage, backfill to Default Project"
```

---

### Task 2: Project-scope `page-builder/service.js`

**Files:**
- Modify: `backend/src/modules/page-builder/service.js`
- Test: `backend/src/modules/page-builder/service.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/page-builder/service.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { listPages, getPage, createPage, updatePage, deletePage } from './service.js';

const PROJECT_A = 'proj-AAAA';
const PROJECT_B = 'proj-BBBB';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPages — project scoping', () => {
  it('queries only by the supplied project_id', async () => {
    prisma.builderPage = { findMany: vi.fn().mockResolvedValue([]) };

    await listPages(PROJECT_A);

    expect(prisma.builderPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ project_id: PROJECT_A, deleted_at: null }),
      })
    );
  });
});

describe('getPage — cross-project isolation', () => {
  it('returns null when the page belongs to a different project', async () => {
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(null) };

    const result = await getPage('page-1', PROJECT_A);

    expect(result).toBeNull();
    expect(prisma.builderPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'page-1', project_id: PROJECT_A }),
      })
    );
  });

  it('returns the page when project_id matches', async () => {
    const page = { id: 'page-1', project_id: PROJECT_A, deleted_at: null };
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(page) };

    const result = await getPage('page-1', PROJECT_A);

    expect(result).toEqual(page);
  });
});

describe('createPage — stamps project_id', () => {
  it('writes project_id from the caller-supplied scope', async () => {
    prisma.builderPage = { create: vi.fn().mockResolvedValue({ id: 'page-1', project_id: PROJECT_A }) };

    await createPage({ title: 'Home', slug: 'home', data: null }, 'user-1', PROJECT_A);

    expect(prisma.builderPage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ project_id: PROJECT_A }) })
    );
  });
});

describe('updatePage / deletePage — cross-project isolation', () => {
  it('updatePage throws 404 when the page belongs to a different project', async () => {
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(null) };

    await expect(updatePage('page-1', { title: 'X' }, 'user-1', PROJECT_A)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('deletePage throws 404 when the page belongs to a different project', async () => {
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(null) };

    await expect(deletePage('page-1', 'user-1', PROJECT_A)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/page-builder/service.test.js`
Expected: FAIL — `listPages`/`getPage`/`createPage`/`updatePage`/`deletePage` don't accept a `projectId` argument yet, and `updatePage`/`deletePage` don't do an existence check at all.

- [ ] **Step 3: Rewrite `service.js`**

Replace `backend/src/modules/page-builder/service.js` in full:

```javascript
import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

function notFound() {
  return Object.assign(new Error('Page not found'), { status: 404 });
}

export const listPages = async (projectId) => {
  return prisma.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null },
    orderBy: { updated_at: 'desc' },
    select: { id: true, slug: true, title: true, status: true, updated_at: true },
  });
};

export const getPage = async (id, projectId) => {
  return prisma.builderPage.findFirst({ where: { id, project_id: projectId, deleted_at: null } });
};

// Unauthenticated public route — scoped by globally-unique slug, not project.
export const getPublishedBySlug = async (slug) => {
  return prisma.builderPage.findFirst({
    where: { slug, status: 'PUBLISHED', deleted_at: null },
    select: { slug: true, title: true, data: true },
  });
};

export const createPage = async ({ title, slug, data }, actorId, projectId) => {
  const page = await prisma.builderPage.create({
    data: {
      title,
      slug,
      status: 'DRAFT',
      data: data ?? { root: { props: { title } }, content: [], zones: {} },
      created_by: actorId,
      project_id: projectId,
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'created',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" created`,
  });
  return page;
};

export const updatePage = async (id, patch, actorId, projectId) => {
  const existing = await getPage(id, projectId);
  if (!existing) throw notFound();

  const page = await prisma.builderPage.update({ where: { id }, data: patch });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: patch.status === 'PUBLISHED' ? 'published' : 'updated',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" ${patch.status === 'PUBLISHED' ? 'published' : 'updated'}`,
  });
  return page;
};

export const deletePage = async (id, actorId, projectId) => {
  const existing = await getPage(id, projectId);
  if (!existing) throw notFound();

  const page = await prisma.builderPage.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'deleted',
    subject_type: 'BuilderPage',
    subject_id: id,
    description: `Page "${page.title}" deleted`,
  });
  return page;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/modules/page-builder/service.test.js`
Expected: PASS (5 describe blocks, 6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/page-builder/service.js backend/src/modules/page-builder/service.test.js
git commit -m "feat(page-builder): project-scope all page CRUD, 404 on cross-project access"
```

---

### Task 3: Project-scope routes — default-project fallback middleware

**Files:**
- Create: `backend/src/modules/page-builder/project-scope.js`
- Test: `backend/src/modules/page-builder/project-scope.test.js`
- Modify: `backend/src/modules/page-builder/routes.js`
- Modify: `backend/src/modules/page-builder/controller.js`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/page-builder/project-scope.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { prisma } from '../../config/database.js';
import { resolveProjectScope } from './project-scope.js';

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveProjectScope', () => {
  it('uses the X-Project-Id header when present', async () => {
    const req = { headers: { 'x-project-id': 'proj-explicit' } };
    const res = makeRes();
    const next = vi.fn();

    await resolveProjectScope(req, res, next);

    expect(req.projectId).toBe('proj-explicit');
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to the Default Project when no header is present', async () => {
    prisma.project = {
      findFirst: vi.fn().mockResolvedValue({ id: 'proj-default' }),
    };
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await resolveProjectScope(req, res, next);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({ where: { is_default: true } });
    expect(req.projectId).toBe('proj-default');
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 500 when no header and no Default Project exists', async () => {
    prisma.project = { findFirst: vi.fn().mockResolvedValue(null) };
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await resolveProjectScope(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/page-builder/project-scope.test.js`
Expected: FAIL — `Cannot find module './project-scope.js'`.

- [ ] **Step 3: Write `project-scope.js`**

Create `backend/src/modules/page-builder/project-scope.js`:

```javascript
// Page-builder's standalone /admin/page-builder screen has no project selector
// today (KDL-558 Phase 1 deviation — see plan pre-flight notes). Calls that carry
// an explicit X-Project-Id (Studio's inline editor) are scoped to that project;
// calls without one (the standalone screen) fall back to the seeded Default
// Project, matching the existing is_shared/is_default org-wide convention.
//
// This is intentionally NOT the shared requireProject() middleware — that one
//400s on a missing header, which three other modules (template-engine,
// collateral usage sites, brand-kit) rely on. This module needs a softer default.
import { prisma } from '../../config/database.js';
import { errorResponse } from '../../shared/utils/response.js';

export async function resolveProjectScope(req, res, next) {
  const header = req.headers['x-project-id'];
  if (header) {
    req.projectId = header;
    return next();
  }

  const defaultProject = await prisma.project.findFirst({ where: { is_default: true } });
  if (!defaultProject) {
    return errorResponse(res, 'No X-Project-Id supplied and no Default Project is seeded', 500);
  }

  req.projectId = defaultProject.id;
  return next();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/modules/page-builder/project-scope.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the middleware into routes and read `req.projectId` in the controller**

Replace `backend/src/modules/page-builder/routes.js` in full:

```javascript
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { resolveProjectScope } from './project-scope.js';
import {
  getAll,
  getOne,
  getPublic,
  getSitemapXml,
  getStarters,
  postCreate,
  putUpdate,
  remove,
} from './controller.js';

const router = Router();

// Public — no auth, no project scope (slug is globally unique).
router.get('/public/:slug', getPublic);
router.get('/sitemap.xml', getSitemapXml);

// Admin CRUD — authenticated + RBAC-gated + project-scoped.
router.get('/starters', authenticate, requirePermission('page-builder', 'view'), getStarters);
router.get('/', authenticate, requirePermission('page-builder', 'view'), resolveProjectScope, getAll);
router.get('/:id', authenticate, requirePermission('page-builder', 'view'), resolveProjectScope, getOne);
router.post('/', authenticate, requirePermission('page-builder', 'add'), resolveProjectScope, postCreate);
router.put('/:id', authenticate, requirePermission('page-builder', 'edit'), resolveProjectScope, putUpdate);
router.delete('/:id', authenticate, requirePermission('page-builder', 'delete'), resolveProjectScope, remove);

export default router;
```

Replace `backend/src/modules/page-builder/controller.js` in full (adds `getSitemapXml`/`getStarters` as thin pass-throughs implemented in Tasks 4–5, and reads `req.projectId` everywhere else):

```javascript
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createPageSchema, updatePageSchema } from './schema.js';
import * as service from './service.js';
import { buildSitemapXml } from './sitemap.js';
import { STARTERS } from './starters.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await service.listPages(req.projectId);
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const page = await service.getPage(req.params.id, req.projectId);
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page });
  } catch (err) {
    next(err);
  }
};

// Public — no auth. Only returns PUBLISHED pages.
export const getPublic = async (req, res, next) => {
  try {
    const page = await service.getPublishedBySlug(req.params.slug);
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page });
  } catch (err) {
    next(err);
  }
};

export const getSitemapXml = async (req, res, next) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId) return errorResponse(res, 'projectId query param is required', 400);
    const pages = await service.listPages(projectId);
    const published = pages.filter((p) => p.status === 'PUBLISHED');
    res.set('Content-Type', 'application/xml');
    res.send(buildSitemapXml(published));
  } catch (err) {
    next(err);
  }
};

export const getStarters = async (req, res, next) => {
  try {
    const pack = req.query.pack;
    const starters = pack ? (STARTERS[pack] ?? []) : Object.values(STARTERS).flat();
    successResponse(res, { starters: starters.map(({ id, pack: p, label }) => ({ id, pack: p, label })) });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createPageSchema.parse(req.body);
    const page = await service.createPage(data, req.user?.id, req.projectId);
    successResponse(res, { page }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const patch = updatePageSchema.parse(req.body);
    const page = await service.updatePage(req.params.id, patch, req.user?.id, req.projectId);
    successResponse(res, { page });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await service.deletePage(req.params.id, req.user?.id, req.projectId);
    successResponse(res, { ok: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
```

Note: this controller imports `./sitemap.js` and `./starters.js`, which don't exist yet — that's expected, Tasks 4 and 5 create them. The app won't boot cleanly until then; that's fine, this is one continuous plan executed in order.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/page-builder/project-scope.js backend/src/modules/page-builder/project-scope.test.js backend/src/modules/page-builder/routes.js backend/src/modules/page-builder/controller.js
git commit -m "feat(page-builder): project-scope routes with Default Project fallback"
```

---

### Task 4: Sitemap generation

**Files:**
- Create: `backend/src/modules/page-builder/sitemap.js`
- Test: `backend/src/modules/page-builder/sitemap.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/page-builder/sitemap.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { buildSitemapXml } from './sitemap.js';

describe('buildSitemapXml', () => {
  it('renders one <url> entry per page with its slug', () => {
    const xml = buildSitemapXml([
      { slug: 'home', updated_at: new Date('2026-08-24T00:00:00Z') },
      { slug: 'about', updated_at: new Date('2026-08-20T00:00:00Z') },
    ]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>/p/home</loc>');
    expect(xml).toContain('<loc>/p/about</loc>');
    expect(xml).toContain('<lastmod>2026-08-24</lastmod>');
  });

  it('returns an empty urlset for no pages', () => {
    const xml = buildSitemapXml([]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/page-builder/sitemap.test.js`
Expected: FAIL — `Cannot find module './sitemap.js'`.

- [ ] **Step 3: Write `sitemap.js`**

Create `backend/src/modules/page-builder/sitemap.js`:

```javascript
// Builds a standard sitemap.xml document from a list of published pages.
// Pure function — no I/O — the caller is responsible for filtering to
// PUBLISHED pages and scoping by project before calling this.
export function buildSitemapXml(pages) {
  const urls = pages
    .map((p) => {
      const lastmod = new Date(p.updated_at).toISOString().slice(0, 10);
      return `  <url><loc>/p/${p.slug}</loc><lastmod>${lastmod}</lastmod></url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + (urls ? `\n${urls}\n` : '') + '</urlset>',
  ].join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/modules/page-builder/sitemap.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/page-builder/sitemap.js backend/src/modules/page-builder/sitemap.test.js
git commit -m "feat(page-builder): add sitemap.xml generation"
```

---

### Task 5: Starter templates + listing endpoint

**Files:**
- Create: `backend/src/modules/page-builder/starters.js`
- Test: `backend/src/modules/page-builder/starters.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/page-builder/starters.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { STARTERS, resolveStarterData } from './starters.js';

describe('STARTERS catalogue', () => {
  it('has at least one starter per pack (general, medical, construction)', () => {
    expect(STARTERS.general.length).toBeGreaterThan(0);
    expect(STARTERS.medical.length).toBeGreaterThan(0);
    expect(STARTERS.construction.length).toBeGreaterThan(0);
  });

  it('every starter has a valid Puck Data shape', () => {
    for (const pack of Object.values(STARTERS)) {
      for (const starter of pack) {
        expect(starter).toMatchObject({ id: expect.any(String), pack: expect.any(String), label: expect.any(String) });
        expect(starter.data).toMatchObject({ root: { props: expect.any(Object) }, content: expect.any(Array) });
      }
    }
  });
});

describe('resolveStarterData', () => {
  it('resolves "general:homeMarketing" to that starter\'s data', () => {
    const data = resolveStarterData('general:homeMarketing');
    expect(data).toEqual(STARTERS.general.find((s) => s.id === 'homeMarketing').data);
  });

  it('returns null for an unknown templateId', () => {
    expect(resolveStarterData('nope:nope')).toBeNull();
  });

  it('returns null when templateId is undefined', () => {
    expect(resolveStarterData(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/page-builder/starters.test.js`
Expected: FAIL — `Cannot find module './starters.js'`.

- [ ] **Step 3: Write `starters.js`**

Create `backend/src/modules/page-builder/starters.js`. Component names match the frontend packs exactly (`frontend/src/app/admin/page-builder/packs/general/index.tsx`, `.../medical/index.tsx`, `.../construction/index.tsx`) — if those packs' component names or `defaultProps` shape ever change, these starters must be updated to match, or the Puck editor will render unknown-component placeholders instead of the intended layout.

```javascript
// Starter page presets — one-click Puck `Data` starting points per industry
// pack, matching the prototype's "Home page templates" gallery. Plain JSON,
// no JSX, so this is safely importable from the Node backend (the driver that
// seeds pages) without pulling in frontend React/Puck component code.
//
// Component keys below MUST match frontend/src/app/admin/page-builder/packs/*
// exactly (label, prop names) — there is no shared-package boundary enforcing
// this today; a pack rename/refactor must update this file too.

const generalHome = {
  id: 'homeMarketing',
  pack: 'general',
  label: 'Marketing home',
  data: {
    root: { props: { title: 'Home' } },
    content: [
      { type: 'Hero', props: {
        title: 'Build faster with KDL',
        subtitle: 'A flexible, modern page builder that ships responsive pages to every device.',
        ctaLabel: 'Get started', ctaHref: '#', align: 'center',
      } },
      { type: 'Section', props: { background: 'muted', padding: 'lg', content: [
        { type: 'Heading', props: { text: 'What we do', level: '2', align: 'center' } },
        { type: 'Text', props: { text: 'Write something compelling here.', align: 'center', muted: false } },
      ] } },
    ],
    zones: {},
  },
};

const medicalHome = {
  id: 'homeClinic',
  pack: 'medical',
  label: 'Clinic home',
  data: {
    root: { props: { title: 'Home' } },
    content: [
      { type: 'MedicalHero', props: {} },
      { type: 'MedicalServicesList', props: {} },
      { type: 'MedicalContactHours', props: {} },
    ],
    zones: {},
  },
};

const constructionHome = {
  id: 'homeBuilder',
  pack: 'construction',
  label: 'Construction home',
  data: {
    root: { props: { title: 'Home' } },
    content: [
      { type: 'ConstructionHero', props: {} },
      { type: 'ConstructionServicesGrid', props: {} },
      { type: 'ConstructionQuoteCTA', props: {} },
    ],
    zones: {},
  },
};

export const STARTERS = {
  general: [generalHome],
  medical: [medicalHome],
  construction: [constructionHome],
};

// templateId format: "<pack>:<starterId>", e.g. "general:homeMarketing".
export function resolveStarterData(templateId) {
  if (!templateId) return null;
  const [pack, id] = templateId.split(':');
  const starter = STARTERS[pack]?.find((s) => s.id === id);
  return starter?.data ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/modules/page-builder/starters.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full page-builder test suite so far**

Run: `cd backend && npx vitest run src/modules/page-builder`
Expected: PASS — all of Tasks 2–5's tests pass together (`service.test.js`, `project-scope.test.js`, `sitemap.test.js`, `starters.test.js`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/page-builder/starters.js backend/src/modules/page-builder/starters.test.js
git commit -m "feat(page-builder): add starter template catalogue + resolver"
```

---

### Task 6: Thread `body` through `advanceStage` (template-engine)

**Files:**
- Modify: `backend/src/modules/template-engine/schema.js`
- Modify: `backend/src/modules/template-engine/controller.js:65-86` (the `advanceStage` controller)
- Modify: `backend/src/modules/template-engine/service.js` (the `advanceStage` export, `export async function advanceStage(runId, stageSlug, userId, projectId) {`)
- Test: `backend/src/modules/template-engine/template-engine.test.js` (extend)

- [ ] **Step 1: Write the failing test**

Add to `backend/src/modules/template-engine/template-engine.test.js` (open the file first to place this alongside the other `advanceStage` tests, following its existing `vi.mock` setup for `./drivers/index.js` and `../../config/database.js`):

```javascript
describe('advanceStage — body threading', () => {
  it('passes the body argument through to driver.execute', async () => {
    const fakeDriver = { execute: vi.fn().mockResolvedValue({ outputRef: { ok: true } }) };
    getDriver.mockReturnValue(fakeDriver);

    prisma.templateEngineRun.findUnique.mockResolvedValue({
      id: 'run-1',
      projectId: 'proj-A',
      stages: [{ stage: 'APPROVAL', status: 'DONE' }],
    });
    prisma.templateEngineStage.upsert.mockResolvedValue({ id: 'stage-1', outputRef: null });
    prisma.templateEngineStage.update.mockResolvedValue({ id: 'stage-1', status: 'DONE' });

    await advanceStage('run-1', 'website', 'user-1', 'proj-A', { pages: [{ key: 'home', title: 'Home' }] });

    expect(fakeDriver.execute).toHaveBeenCalledWith(
      expect.objectContaining({ body: { pages: [{ key: 'home', title: 'Home' }] } })
    );
  });

  it('defaults body to an empty object when the caller omits it', async () => {
    const fakeDriver = { execute: vi.fn().mockResolvedValue({ outputRef: {} }) };
    getDriver.mockReturnValue(fakeDriver);

    prisma.templateEngineRun.findUnique.mockResolvedValue({
      id: 'run-1',
      projectId: 'proj-A',
      stages: [{ stage: 'APPROVAL', status: 'DONE' }],
    });
    prisma.templateEngineStage.upsert.mockResolvedValue({ id: 'stage-1', outputRef: null });
    prisma.templateEngineStage.update.mockResolvedValue({ id: 'stage-1', status: 'DONE' });

    await advanceStage('run-1', 'website', 'user-1', 'proj-A');

    expect(fakeDriver.execute).toHaveBeenCalledWith(expect.objectContaining({ body: {} }));
  });
});
```

Check the top of `template-engine.test.js` for how `prisma` and `getDriver` are already mocked/imported in that file (it mirrors `drivers/website.driver.test.js`'s mock style) and use the same import names — do not introduce a second, differently-shaped mock of the same module.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/template-engine/template-engine.test.js -t "body threading"`
Expected: FAIL — `driver.execute` is called without a `body` key (current signature is `{ run, stageRecord, userId, projectId }`).

- [ ] **Step 3: Update `service.js`**

In `backend/src/modules/template-engine/service.js`, find:

```javascript
export async function advanceStage(runId, stageSlug, userId, projectId) {
```

Change to:

```javascript
export async function advanceStage(runId, stageSlug, userId, projectId, body = {}) {
```

Find the driver call inside the same function:

```javascript
    const result = await driver.execute({
      run,
      stageRecord,
      userId,
      projectId,
    });
```

Change to:

```javascript
    const result = await driver.execute({
      run,
      stageRecord,
      userId,
      projectId,
      body,
    });
```

- [ ] **Step 4: Update `controller.js`**

In `backend/src/modules/template-engine/controller.js`, find:

```javascript
    const stageRecord = await service.advanceStage(runId, stage, req.user.id, projectId);
```

Change to:

```javascript
    const stageRecord = await service.advanceStage(runId, stage, req.user.id, projectId, req.validated.body ?? {});
```

- [ ] **Step 5: Extend `advanceStageSchema`**

In `backend/src/modules/template-engine/schema.js`, find:

```javascript
export const advanceStageSchema = z.object({
  params: z.object({
    runId: z.string().min(1),
    stage: stageSlugEnum,
  }),
  // approval stage may carry brandKitVersion on the accept call
  body: z
    .object({
      brandKitVersion: z.number().int().positive().optional(),
    })
    .optional(),
});
```

Replace with:

```javascript
export const advanceStageSchema = z.object({
  params: z.object({
    runId: z.string().min(1),
    stage: stageSlugEnum,
  }),
  // approval stage may carry brandKitVersion on the accept call;
  // website stage carries the user-chosen page list + starter templates.
  body: z
    .object({
      brandKitVersion: z.number().int().positive().optional(),
      pages: z
        .array(
          z.object({
            key: z.string().min(1).max(60),
            title: z.string().min(1).max(200),
            templateId: z.string().min(1).max(120).optional(),
          })
        )
        .min(1)
        .max(20)
        .optional(),
    })
    .optional(),
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/modules/template-engine/template-engine.test.js`
Expected: PASS — including the two new tests and everything already in that file.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/template-engine/service.js backend/src/modules/template-engine/controller.js backend/src/modules/template-engine/schema.js backend/src/modules/template-engine/template-engine.test.js
git commit -m "feat(template-engine): thread advance-stage body through to drivers"
```

---

### Task 7: Rewrite `websiteDriver` to use the page-list body

**Files:**
- Modify: `backend/src/modules/template-engine/drivers/index.js`
- Modify: `backend/src/modules/template-engine/drivers/website.driver.test.js`

- [ ] **Step 1: Write the failing tests**

In `backend/src/modules/template-engine/drivers/website.driver.test.js`, add `resolveStarterData` to the existing `page-builder/service.js` mock block:

```javascript
vi.mock('../../page-builder/service.js', () => ({
  createPage: vi.fn(),
  getPage:    vi.fn(),
}));

vi.mock('../../page-builder/starters.js', () => ({
  resolveStarterData: vi.fn(),
}));
```

Add the import alongside the existing ones:

```javascript
import { resolveStarterData } from '../../page-builder/starters.js';
```

Replace the existing `describe('website driver — happy path', ...)` block (it asserts the old hardcoded 3-page behavior) with:

```javascript
describe('website driver — happy path with a caller-supplied page list', () => {
  it('creates one project-scoped page per entry in body.pages, seeded from the resolved starter', async () => {
    resolveStarterData.mockReturnValue({ root: { props: { title: 'Home' } }, content: [{ type: 'Hero', props: {} }], zones: {} });
    createPage.mockResolvedValueOnce({ id: 'page-home', title: 'Home', slug: 'te-run-1-home' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      body: { pages: [{ key: 'home', title: 'Home', templateId: 'general:homeMarketing' }] },
    });

    expect(resolveStarterData).toHaveBeenCalledWith('general:homeMarketing');
    expect(createPage).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Home', slug: 'te-run-1-home' }),
      'user-1',
      'proj-A'
    );
    expect(createPage.mock.calls[0][0].data).toMatchObject({ content: [{ type: 'Hero', props: {} }] });
    expect(result.outputRef.pageIds).toEqual(['page-home']);
    expect(result.outputRef.pageKeyToId).toMatchObject({ home: 'page-home' });
  });

  it('falls back to the legacy home/about/contact seed when body.pages is omitted', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home',    title: 'Home',    slug: 'te-run-1-home' })
      .mockResolvedValueOnce({ id: 'page-about',   title: 'About',   slug: 'te-run-1-about' })
      .mockResolvedValueOnce({ id: 'page-contact', title: 'Contact', slug: 'te-run-1-contact' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      body: {},
    });

    expect(createPage).toHaveBeenCalledTimes(3);
    expect(result.outputRef.pageIds).toEqual(['page-home', 'page-about', 'page-contact']);
  });
});
```

The existing `describe('website driver — crash recovery (§4.1)', ...)` block stays as-is except its `.execute({...})` call needs a `body: {}` added (it currently omits `body` entirely, which would now be `undefined` mid-destructure) — open that block and add `body: {},` next to the existing `projectId: 'proj-A',` line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/template-engine/drivers/website.driver.test.js`
Expected: FAIL — the driver doesn't read `body`, doesn't call `resolveStarterData`, and doesn't pass `projectId` as `createPage`'s third argument yet.

- [ ] **Step 3: Rewrite the `websiteDriver`**

In `backend/src/modules/template-engine/drivers/index.js`, add the import at the top (alongside the existing `page-builder/service.js` import):

```javascript
import { createPage, getPage } from '../../page-builder/service.js';
import { resolveStarterData } from '../../page-builder/starters.js';
```

Replace the `websiteDriver` block (and the `WEBSITE_SEED_PAGES` comment above it stays — it's now the fallback, not the only path):

```javascript
const websiteDriver = {
  async execute({ run, stageRecord, userId, projectId, body }) {
    // Crash recovery (TEMPLATE_ENGINE_ARCH §4.1): reuse pages from a prior attempt.
    const priorMap = stageRecord?.outputRef?.pageKeyToId ?? {};
    const pageKeyToId = {};
    const pageIds = [];

    // Caller-supplied page list (KDL-558 Phase 1) takes priority; falls back to
    // the legacy fixed seed for any existing caller that doesn't send one yet.
    const requestedPages = body?.pages?.length > 0 ? body.pages : WEBSITE_SEED_PAGES;

    for (const { key, title, templateId } of requestedPages) {
      const priorId = priorMap[key];
      let existing = null;
      if (priorId) {
        existing = await getPage(priorId, projectId).catch(() => null);
      }

      const page = existing ?? await createPage(
        { title, slug: `te-${run.id}-${key}`, data: resolveStarterData(templateId) },
        userId,
        projectId,
      );

      pageKeyToId[key] = page.id;
      pageIds.push(page.id);
    }

    return {
      outputRef: {
        pageIds,
        pageKeyToId,
        seededAt: new Date().toISOString(),
      },
    };
  },
};
```

Note `getPage`'s call signature already changed in Task 2 to `getPage(id, projectId)` — this driver already passes `projectId` as the second argument here, matching that.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/modules/template-engine/drivers/website.driver.test.js`
Expected: PASS — both new tests plus the unmodified crash-recovery test.

- [ ] **Step 5: Run the full backend suite to catch any other breakage**

Run: `cd backend && JWT_SECRET="ci-jwt-secret-must-be-at-least-32-characters-long" JWT_REFRESH_SECRET="ci-refresh-secret-must-be-at-least-32-characters" npm test`
Expected: PASS across all modules. If `template-engine.test.js` or `leakage.test.js` fail because they construct a `getPage`/`createPage` call without the new `projectId` argument, update those call sites the same way Task 2 and this task did.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/template-engine/drivers/index.js backend/src/modules/template-engine/drivers/website.driver.test.js
git commit -m "feat(template-engine): website driver seeds pages from caller-supplied page list + starters"
```

---

### Task 8: Backend cross-project leakage test for page-builder

**Files:**
- Create: `backend/src/modules/page-builder/leakage.test.js`

- [ ] **Step 1: Write the test** (this task has no separate "make it pass" step — Tasks 2–3 already implemented the behavior; this codifies the regression guard per CLAUDE.md's "regression test per bug fix" standard, mirroring `template-engine/leakage.test.js`'s structure)

Create `backend/src/modules/page-builder/leakage.test.js`:

```javascript
/**
 * Cross-project leakage tests (KDL-558 Phase 1) — mirrors
 * template-engine/leakage.test.js. Asserts a BuilderPage created under
 * project A is unreachable (404, not a silent empty result) from project B.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { getPage, updatePage, deletePage } from './service.js';

const PROJECT_A = 'proj-AAAA';
const PROJECT_B = 'proj-BBBB';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPage cross-project isolation', () => {
  it('returns null when the page belongs to project B but the caller is scoped to A', async () => {
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(null) };

    const result = await getPage('page-B', PROJECT_A);

    expect(result).toBeNull();
  });
});

describe('updatePage cross-project isolation', () => {
  it('throws 404 (not 403, not a silent no-op) when the page belongs to project B', async () => {
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(null) };

    await expect(updatePage('page-B', { title: 'Hijacked' }, 'user-1', PROJECT_A)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('deletePage cross-project isolation', () => {
  it('throws 404 when the page belongs to project B', async () => {
    prisma.builderPage = { findFirst: vi.fn().mockResolvedValue(null) };

    await expect(deletePage('page-B', 'user-1', PROJECT_A)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd backend && npx vitest run src/modules/page-builder/leakage.test.js`
Expected: PASS (3 tests) — this should already pass given Task 2's implementation; if it doesn't, Task 2 has a bug, fix it there rather than weakening this test.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/page-builder/leakage.test.js
git commit -m "test(page-builder): add cross-project leakage regression guard"
```

---

### Task 9: Frontend — SEO fields on the Puck root config

**Files:**
- Modify: `frontend/src/app/admin/page-builder/puck.config.tsx`

- [ ] **Step 1: Edit `puck.config.tsx`**

Find:

```tsx
const root: Config['root'] = {
  fields: { title: { type: 'text' } },
  defaultProps: { title: 'Untitled page' },
  render: ({ children }: { children: ReactNode }) => (
    <main className="min-h-screen bg-white text-slate-900">{children}</main>
  ),
}
```

Replace with:

```tsx
const root: Config['root'] = {
  fields: {
    title: { type: 'text' },
    seoTitle: { type: 'text', label: 'SEO title (optional, defaults to page title)' },
    seoDescription: { type: 'textarea', label: 'Meta description' },
  },
  defaultProps: { title: 'Untitled page', seoTitle: '', seoDescription: '' },
  render: ({ children }: { children: ReactNode }) => (
    <main className="min-h-screen bg-white text-slate-900">{children}</main>
  ),
}
```

Find:

```tsx
export const emptyData: Data = {
  root: { props: { title: 'Untitled page' } },
  content: [],
  zones: {},
}
```

Replace with:

```tsx
export const emptyData: Data = {
  root: { props: { title: 'Untitled page', seoTitle: '', seoDescription: '' } },
  content: [],
  zones: {},
}
```

No test for this step — it's a declarative Puck field addition with no branching logic (per CLAUDE.md/ponytail guidance, trivial declarative config doesn't need its own test file; it's exercised by Task 11's RTL test that renders the editor).

- [ ] **Step 2: Type-check**

Run: `cd frontend && pnpm type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page-builder/puck.config.tsx
git commit -m "feat(page-builder): add SEO title/description fields to Puck root config"
```

---

### Task 10: Extract shared `PuckPageEditor` component

**Files:**
- Create: `frontend/src/app/admin/page-builder/PuckPageEditor.tsx`
- Modify: `frontend/src/app/admin/page-builder/[id]/page.tsx`
- Modify: `frontend/src/app/admin/page-builder/store.ts`

- [ ] **Step 1: Add project-scoped variants to `store.ts`**

The standalone screen calls these with no project context (falls back to Default Project per Task 3); the new inline Studio usage must pass the run's real `projectId`. Open `frontend/src/app/admin/page-builder/store.ts` and replace `getPage` and `savePage`:

```typescript
export async function getPage(id: string, projectId?: string): Promise<PageRecord | undefined> {
  try {
    const res = await api.get(`/page-builder/${id}`, projectId ? { headers: { 'X-Project-Id': projectId } } : undefined)
    const raw = res.data.data.page
    return raw ? toRecord(raw) : undefined
  } catch {
    return undefined
  }
}

export async function savePage(id: string, data: Data, projectId?: string): Promise<void> {
  const title = (data.root?.props?.title as string) || undefined
  await api.put(
    `/page-builder/${id}`,
    { ...(title ? { title } : {}), data, status: 'PUBLISHED' },
    projectId ? { headers: { 'X-Project-Id': projectId } } : undefined
  )
}
```

- [ ] **Step 2: Create `PuckPageEditor.tsx`**

Create `frontend/src/app/admin/page-builder/PuckPageEditor.tsx` — this is the `<Puck>` wiring extracted from `[id]/page.tsx`, parameterized so both the standalone route and the inline Studio usage can mount it:

```tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Puck, type Data } from '@puckeditor/core'
import '@puckeditor/core/puck.css'
import { ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { config } from './puck.config'
import { getPage, savePage } from './store'

export interface PuckPageEditorProps {
  pageId: string
  /** Pass the Studio run's project id when embedding inline; omit for the standalone screen (falls back to the Default Project). */
  projectId?: string
  onPublished?: () => void
}

/**
 * Shared Puck editor mount point. Both the standalone /admin/page-builder/[id]
 * route and Studio's inline WebsiteStage render this — one Puck config, two
 * mount points, per the module's "no second Puck instance" rule (README.md).
 */
export function PuckPageEditor({ pageId, projectId, onPublished }: PuckPageEditorProps) {
  const qc = useQueryClient()

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['page-builder-page', pageId, projectId ?? null],
    queryFn: () => getPage(pageId, projectId),
  })

  const saveMutation = useMutation({
    mutationFn: (data: Data) => savePage(pageId, data, projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['page-builder-pages'] })
      void qc.invalidateQueries({ queryKey: ['page-builder-page', pageId, projectId ?? null] })
      toast({ title: 'Published', description: 'Page saved and published.' })
      onPublished?.()
    },
    onError: () =>
      toast({
        title: 'Save failed',
        description: 'Could not save the page.',
        variant: 'destructive',
      }),
  })

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading editor…</div>

  if (isError || !page) {
    return <div className="p-8 text-muted-foreground">Page not found.</div>
  }

  return (
    <Puck
      config={config}
      data={page.data}
      iframe={{ enabled: false }}
      viewports={[
        { width: 390, label: 'Mobile' },
        { width: 768, label: 'Tablet' },
        { width: 1280, label: 'Desktop' },
      ]}
      headerTitle={page.title}
      headerPath={`/p/${page.slug}`}
      onPublish={(data: Data) => {
        saveMutation.mutate(data)
      }}
      overrides={{
        headerActions: ({ children }) => (
          <>
            <a
              href={`/p/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              <ExternalLink size={15} /> View
            </a>
            {children}
          </>
        ),
      }}
    />
  )
}
```

- [ ] **Step 3: Slim `[id]/page.tsx` down to a thin route wrapper**

Replace `frontend/src/app/admin/page-builder/[id]/page.tsx` in full:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PuckPageEditor } from '../PuckPageEditor'

export default function PageBuilderEditor() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  return (
    <ModuleGuard slug="page-builder">
      <div className="h-[calc(100vh-var(--th-layout-header-height))]">
        <PuckPageEditor
          pageId={params.id}
          onPublished={() => {
            window.open(`/p/${params.id}`, '_blank')
          }}
        />
        <button
          onClick={() => router.push('/admin/page-builder')}
          className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg hover:bg-foreground/80"
        >
          <ArrowLeft size={15} /> Pages
        </button>
      </div>
    </ModuleGuard>
  )
}
```

Note the `onPublished` callback here opens `/p/${params.id}` — this is a pre-existing bug carried over unchanged from the original file (it opens by page *id*, not *slug*; the original code had `window.open(`/p/${page.slug}`, ...)` inline where `page` was in scope, but the extracted component no longer exposes `page.slug` to this wrapper). Fix it properly: change the callback to not need the slug at all, since `PuckPageEditor`'s own header already has a "View" link to the correct `/p/${page.slug}` URL (see the `headerActions` override in Step 2) — drop the `onPublished` prop and the `window.open` call entirely:

```tsx
        <PuckPageEditor pageId={params.id} />
```

- [ ] **Step 4: Manual smoke test**

Run: `cd backend && npm run dev` (in one terminal) and `cd frontend && pnpm dev` (in another), then open `http://localhost:3000/admin/page-builder`, create a page, open its editor, drag a block in, click Publish, click "View" in the header — confirm the public `/p/<slug>` page renders the block. This exercises the extraction end-to-end; there's no automated test for this step because it requires the dev stack running (Task 11 covers the automatable RTL-level behavior).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/page-builder/PuckPageEditor.tsx frontend/src/app/admin/page-builder/[id]/page.tsx frontend/src/app/admin/page-builder/store.ts
git commit -m "refactor(page-builder): extract shared PuckPageEditor for reuse in Studio"
```

---

### Task 11: `useAdvanceStage` — accept a stage-specific body

**Files:**
- Modify: `frontend/src/hooks/useTemplateEngine.ts`
- Test: `frontend/tests/rtl/regression/use-advance-stage-body.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/rtl/regression/use-advance-stage-body.test.tsx`:

```tsx
/**
 * RTL regression test for KDL-558 Phase 1 — useAdvanceStage must forward an
 * optional stage-specific body (e.g. WebsiteStage's page list) without
 * breaking existing callers that pass just a stage string.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAdvanceStage } from '@/hooks/useTemplateEngine'

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useAdvanceStage', () => {
  let apiPost: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const api = await import('@/lib/axios')
    apiPost = api.default.post as ReturnType<typeof vi.fn>
    apiPost.mockResolvedValue({ data: { data: { id: 'stage-1', status: 'DONE' } } })
  })

  it('posts undefined body for a bare stage string (existing callers)', async () => {
    const { result } = renderHook(() => useAdvanceStage('run-1', 'proj-1'), { wrapper })

    result.current.mutate('INTAKE')

    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(apiPost).toHaveBeenCalledWith(
      '/template-engine/runs/run-1/stages/intake/advance',
      undefined,
      expect.objectContaining({ headers: { 'X-Project-Id': 'proj-1' } })
    )
  })

  it('posts the body when called with { stage, body }', async () => {
    const { result } = renderHook(() => useAdvanceStage('run-1', 'proj-1'), { wrapper })

    result.current.mutate({ stage: 'WEBSITE', body: { pages: [{ key: 'home', title: 'Home' }] } })

    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(apiPost).toHaveBeenCalledWith(
      '/template-engine/runs/run-1/stages/website/advance',
      { pages: [{ key: 'home', title: 'Home' }] },
      expect.objectContaining({ headers: { 'X-Project-Id': 'proj-1' } })
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && pnpm test tests/rtl/regression/use-advance-stage-body.test.tsx`
Expected: FAIL — `useAdvanceStage`'s `mutationFn` currently accepts only `DagStage` and always posts `undefined`.

- [ ] **Step 3: Widen `useAdvanceStage`**

In `frontend/src/hooks/useTemplateEngine.ts`, find the `useAdvanceStage` function (around line 82) and replace its body:

```typescript
export function useAdvanceStage(runId: string, projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    // Advance/retry/skip return the mutated stage record, not the run —
    // invalidate both run caches so the UI refetches the fresh run.
    // Accepts either a bare stage (existing callers) or { stage, body } when
    // the stage needs input (e.g. WebsiteStage's page list, KDL-558 Phase 1).
    mutationFn: (input: DagStage | { stage: DagStage; body?: Record<string, unknown> }) => {
      const stage = typeof input === 'string' ? input : input.stage
      const body = typeof input === 'string' ? undefined : input.body
      return api
        .post<{ success: boolean; data: TemplateEngineStage }>(
          `${BASE}/runs/${runId}/stages/${stageEnumToSlug(stage)}/advance`,
          body,
          projectScope(projectId)
        )
        .then((r) => r.data.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: runKey(runId) })
      qc.invalidateQueries({ queryKey: runsKey(projectId) })
    },
    onError: (err) => {
      toast({ title: extractErrorCode(err), variant: 'destructive' })
      qc.invalidateQueries({ queryKey: runKey(runId) })
    },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm test tests/rtl/regression/use-advance-stage-body.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing Studio regression suite to confirm no callers broke**

Run: `cd frontend && pnpm test tests/rtl/regression/template-engine-studio.test.tsx tests/rtl/regression/template-engine-project-header.test.tsx`
Expected: PASS — every other stage component calls `advance.mutate('SOME_STAGE')` (a bare string), which is still valid input to the widened type.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useTemplateEngine.ts frontend/tests/rtl/regression/use-advance-stage-body.test.tsx
git commit -m "feat(template-engine): useAdvanceStage accepts an optional stage-specific body"
```

---

### Task 12: Rewrite `WebsiteStage` — page list, template picker, inline editor

**Files:**
- Create: `frontend/src/hooks/useWebsiteStarters.ts`
- Modify: `frontend/src/app/admin/template-engine/_components/stages/WebsiteStage.tsx`
- Test: `frontend/tests/rtl/regression/template-engine-website-stage.test.tsx`

- [ ] **Step 1: Create the starters-listing hook**

Create `frontend/src/hooks/useWebsiteStarters.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface Starter {
  id: string
  pack: string
  label: string
}

export function useWebsiteStarters() {
  return useQuery({
    queryKey: ['page-builder', 'starters'],
    queryFn: () =>
      api.get<{ success: boolean; data: { starters: Starter[] } }>('/page-builder/starters').then((r) => r.data.data.starters),
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Write the failing RTL test**

Create `frontend/tests/rtl/regression/template-engine-website-stage.test.tsx`:

```tsx
/**
 * RTL regression tests for KDL-558 Phase 1 — WebsiteStage page-list step.
 *
 * Covers:
 *   A. No pages generated yet → page-list form renders with one default row
 *   B. Add row, fill it in, submit → advance.mutate called with { stage, body: { pages } }
 *   C. Pages already generated (outputRef.pageIds present) → tab list renders,
 *      selecting a tab mounts PuckPageEditor with that page's id
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WebsiteStage } from '@/app/admin/template-engine/_components/stages/WebsiteStage'
import type { TemplateEngineRun } from '@/types/template-engine.types'

const { mockAdvanceMutate } = vi.hoisted(() => ({ mockAdvanceMutate: vi.fn() }))

vi.mock('@/hooks/useTemplateEngine', () => ({
  useAdvanceStage: () => ({ mutate: mockAdvanceMutate, isPending: false }),
  useRetryStage: () => ({ mutate: vi.fn(), isPending: false }),
  useSkipStage: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/hooks/useWebsiteStarters', () => ({
  useWebsiteStarters: () => ({
    data: [{ id: 'homeMarketing', pack: 'general', label: 'Marketing home' }],
    isLoading: false,
  }),
}))

vi.mock('@/app/admin/page-builder/PuckPageEditor', () => ({
  PuckPageEditor: ({ pageId }: { pageId: string }) => <div data-testid="puck-editor">{pageId}</div>,
}))

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function makeRun(stageOverrides: Partial<TemplateEngineRun['stages'][0]> = {}): TemplateEngineRun {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    status: 'IN_PROGRESS',
    brandKitVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-08-24T00:00:00Z',
    updatedAt: '2026-08-24T00:00:00Z',
    stages: [
      { id: 'stage-1', runId: 'run-1', stage: 'WEBSITE', status: 'PENDING', errorCode: null, outputRef: null, startedAt: null, completedAt: null, ...stageOverrides },
    ],
  }
}

beforeEach(() => vi.clearAllMocks())

describe('WebsiteStage — page-list step (no pages yet)', () => {
  it('renders a page-list form with one default row', () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    expect(screen.getByLabelText(/page title/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add page/i })).toBeInTheDocument()
  })

  it('submits the page list via advance.mutate({ stage, body })', async () => {
    renderWithQC(<WebsiteStage run={makeRun()} />)

    fireEvent.change(screen.getByLabelText(/page title/i), { target: { value: 'Home' } })
    fireEvent.click(screen.getByRole('button', { name: /generate pages/i }))

    await waitFor(() =>
      expect(mockAdvanceMutate).toHaveBeenCalledWith({
        stage: 'WEBSITE',
        body: { pages: [{ key: 'home', title: 'Home', templateId: undefined }] },
      })
    )
  })
})

describe('WebsiteStage — pages already generated', () => {
  it('renders a tab per generated page and mounts PuckPageEditor for the selected one', () => {
    renderWithQC(
      <WebsiteStage
        run={makeRun({ status: 'DONE', outputRef: { pageIds: ['page-home', 'page-about'], pageKeyToId: { home: 'page-home', about: 'page-about' } } })}
      />
    )

    expect(screen.getByTestId('puck-editor')).toHaveTextContent('page-home')
    fireEvent.click(screen.getByRole('tab', { name: /about/i }))
    expect(screen.getByTestId('puck-editor')).toHaveTextContent('page-about')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && pnpm test tests/rtl/regression/template-engine-website-stage.test.tsx`
Expected: FAIL — the current `WebsiteStage` has none of this markup (`getByLabelText(/page title/i)` etc. don't exist).

- [ ] **Step 4: Rewrite `WebsiteStage.tsx`**

Replace `frontend/src/app/admin/template-engine/_components/stages/WebsiteStage.tsx` in full:

```tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdvanceStage, useRetryStage, useSkipStage } from '@/hooks/useTemplateEngine'
import { useWebsiteStarters } from '@/hooks/useWebsiteStarters'
import { PuckPageEditor } from '@/app/admin/page-builder/PuckPageEditor'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

interface PageRow {
  key: string
  title: string
  templateId?: string
}

function slugKey(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'page'
}

export function WebsiteStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'WEBSITE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const skip = useSkipStage(run.id, run.projectId)
  const { data: starters = [] } = useWebsiteStarters()

  const [rows, setRows] = useState<PageRow[]>([{ key: '', title: '' }])

  const outputRef = stage?.outputRef as
    | { pageIds?: string[]; pageKeyToId?: Record<string, string> }
    | null
    | undefined

  const pageIds = outputRef?.pageIds ?? []
  const [selectedPageId, setSelectedPageId] = useState<string | null>(pageIds[0] ?? null)
  const activePageId = selectedPageId ?? pageIds[0] ?? null

  if (pageIds.length > 0 && outputRef?.pageKeyToId) {
    const entries = Object.entries(outputRef.pageKeyToId)
    return (
      <StageShell
        title="Website Assembly"
        description="Pages generated for this run. Select a page below to edit it in place."
        stage={stage ?? null}
        hideRunButton
      >
        <div className="space-y-4">
          <div role="tablist" className="flex flex-wrap gap-2 border-b pb-2">
            {entries.map(([key, pageId]) => (
              <button
                key={pageId}
                role="tab"
                aria-selected={activePageId === pageId}
                onClick={() => setSelectedPageId(pageId)}
                className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                  activePageId === pageId ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          {activePageId && (
            <div className="h-[70vh] overflow-hidden rounded-lg border">
              <PuckPageEditor pageId={activePageId} projectId={run.projectId} />
            </div>
          )}
        </div>
      </StageShell>
    )
  }

  const updateRow = (index: number, patch: Partial<PageRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const submit = () => {
    const pages = rows
      .filter((r) => r.title.trim().length > 0)
      .map((r) => ({ key: slugKey(r.title), title: r.title.trim(), templateId: r.templateId }))

    advance.mutate({ stage: 'WEBSITE', body: { pages } })
  }

  const isFailed = stage?.status === 'FAILED'

  return (
    <StageShell
      title="Website Assembly"
      description="Choose the pages to generate and an optional starter template for each. Pages are created in the page-builder engine and editable inline once generated."
      stage={stage ?? null}
      hideRunButton
    >
      {isFailed && (
        <div className="flex items-center gap-2 pb-2">
          <Button size="sm" onClick={() => retry.mutate('WEBSITE')} disabled={retry.isPending}>
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={() => skip.mutate('WEBSITE')}>
            Skip
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`page-title-${i}`}>Page title</Label>
              <Input
                id={`page-title-${i}`}
                value={row.title}
                onChange={(e) => updateRow(i, { title: e.target.value })}
                placeholder="e.g. Home"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`page-template-${i}`}>Starter template</Label>
              <select
                id={`page-template-${i}`}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={row.templateId ?? ''}
                onChange={(e) => updateRow(i, { templateId: e.target.value || undefined })}
              >
                <option value="">Blank page</option>
                {starters.map((s) => (
                  <option key={s.id} value={`${s.pack}:${s.id}`}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={rows.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, { key: '', title: '' }])}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add page
        </Button>
      </div>
      <div className="pt-4">
        <Button
          onClick={submit}
          disabled={advance.isPending || rows.every((r) => !r.title.trim())}
        >
          Generate pages
        </Button>
      </div>
    </StageShell>
  )
}
```

`StageShell` already supports `hideRunButton` (see its props in `StageShell.tsx`) — this stage no longer uses the generic "Run stage" button because generation is triggered by the "Generate pages" button inside its own form, which carries the page-list body the generic button can't provide.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && pnpm test tests/rtl/regression/template-engine-website-stage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full frontend regression suite**

Run: `cd frontend && pnpm test`
Expected: PASS across all `tests/rtl/regression/*`, including `template-engine-studio.test.tsx` and `template-engine-project-header.test.tsx` (Task 11 already checked these don't break from the `useAdvanceStage` widening; this step catches anything WebsiteStage-specific).

- [ ] **Step 7: Type-check and lint**

Run: `cd frontend && pnpm type-check && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/hooks/useWebsiteStarters.ts frontend/src/app/admin/template-engine/_components/stages/WebsiteStage.tsx frontend/tests/rtl/regression/template-engine-website-stage.test.tsx
git commit -m "feat(template-engine): WebsiteStage gets a page-list step + inline Puck editor"
```

---

### Task 13: Backend sitemap route regression test + full-suite check

**Files:**
- Create: `backend/src/modules/page-builder/sitemap-route.test.js`

- [ ] **Step 1: Write the test**

This closes the loop the spec called for ("sitemap only includes this project's published pages") at the controller level, since Task 4's test only covers the pure XML-building function, not the project/status filtering that happens in the controller.

Create `backend/src/modules/page-builder/sitemap-route.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));

import { prisma } from '../../config/database.js';
import { getSitemapXml } from './controller.js';

function makeRes() {
  return { set: vi.fn(), send: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
}

beforeEach(() => vi.clearAllMocks());

describe('getSitemapXml', () => {
  it('includes only PUBLISHED pages for the requested project', async () => {
    prisma.builderPage = {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', slug: 'home', status: 'PUBLISHED', updated_at: new Date('2026-08-24') },
        { id: '2', slug: 'draft-page', status: 'DRAFT', updated_at: new Date('2026-08-24') },
      ]),
    };
    const req = { query: { projectId: 'proj-A' } };
    const res = makeRes();

    await getSitemapXml(req, res, vi.fn());

    expect(prisma.builderPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ project_id: 'proj-A' }) })
    );
    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain('<loc>/p/home</loc>');
    expect(xml).not.toContain('draft-page');
  });

  it('returns 400 when projectId is missing', async () => {
    const req = { query: {} };
    const res = makeRes();

    await getSitemapXml(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd backend && npx vitest run src/modules/page-builder/sitemap-route.test.js`
Expected: PASS (2 tests) — this exercises code already written in Task 3; if it fails, fix `getSitemapXml` in `controller.js`, don't weaken the test.

- [ ] **Step 3: Run the entire backend + frontend suites one final time**

```bash
cd backend && JWT_SECRET="ci-jwt-secret-must-be-at-least-32-characters-long" JWT_REFRESH_SECRET="ci-refresh-secret-must-be-at-least-32-characters" npm test
cd ../frontend && pnpm test && pnpm type-check && pnpm lint
```
Expected: PASS everywhere.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/page-builder/sitemap-route.test.js
git commit -m "test(page-builder): sitemap route project + published-status filtering"
```

---

## Post-implementation

- Update `STATUS.md`'s rolling changelog (per `CLAUDE.md`'s Session Protocol, prepend under `## Rolling changelog`) noting: `page-builder` is now project-scoped, `template-engine`'s WEBSITE stage has a real design surface, and the `websiteDriver`'s legacy 3-page fallback still exists for backward compatibility.
- Run `node scripts/status-rollup.mjs` since a module's build-state reality changed.
- This plan does not touch `page-builder-ui`/`theme-engine-ui` nav activation or wallet UI — that's Phase 2 (Studio shell/nav fixes), a separate plan.
