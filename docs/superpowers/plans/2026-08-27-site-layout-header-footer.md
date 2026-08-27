# Site Layout (shared Header/Footer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Layout" tab to the template-engine page editor where Header/Footer are configured once per project and apply to every page in that project, replacing today's per-page baked-in `NavBar`/`Footer` blocks.

**Architecture:** New `SiteLayout` Prisma model (one row per project) + a `site-layout` backend module (mirrors the existing `page-builder` module's routes→controller→service→Prisma shape). `BuilderPage` gains a nullable `project_id` so the public renderer can look up a page's layout and so the layout's `PUT` can auto-strip stale per-page `NavBar`/`Footer`/`MedicalTopNav` blocks. The editor gets a real third Puck tab via Puck's `plugins` API (not `overrides` — confirmed the tab strip itself isn't overridable). Both live renderers (`/p/[slug]` and the template-engine "view all pages" preview) wrap Puck's `<Render>` with extracted `NavBarView`/`FooterView` components fed by the shared layout.

**Tech Stack:** Express 5 + Prisma 6 (backend), Next.js 15 + `@puckeditor/core` 0.23.0 + TanStack Query (frontend), Zod validation, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-site-layout-header-footer-design.md`

---

## Task 1: Prisma schema — `SiteLayout` model + `BuilderPage.project_id`

**Files:**
- Create: `backend/prisma/schema/site-layout.prisma`
- Modify: `backend/prisma/schema/page-builder.prisma`

- [ ] **Step 1: Add the `SiteLayout` model**

Create `backend/prisma/schema/site-layout.prisma`:

```prisma
// Site Layout module schema.
// One row per Project — the Header/Footer config shared across every
// BuilderPage in that project (KDL: shared site layout).

model SiteLayout {
  id         String   @id @default(cuid())
  project_id String   @unique
  header     Json     @default("{}")
  footer     Json     @default("{}")
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("site_layouts")
}
```

- [ ] **Step 2: Add `project_id` to `BuilderPage`**

In `backend/prisma/schema/page-builder.prisma`, replace the `BuilderPage` model with:

```prisma
model BuilderPage {
  id         String     @id @default(cuid())
  slug       String     @unique
  title      String
  status     PageStatus @default(DRAFT)
  data       Json
  project_id String?
  created_by String?
  deleted_at DateTime?
  created_at DateTime   @default(now())
  updated_at DateTime   @updatedAt

  @@index([status])
  @@index([project_id])
  @@map("builder_pages")
}
```

- [ ] **Step 3: Generate and run the migration**

Postgres must already be reachable (this repo runs it on `localhost:5443` per `backend/.env`'s `DATABASE_URL` — confirm with `pg_isready -h localhost -p 5443` if unsure).

Run:
```bash
cd backend && npx prisma migrate dev --name add_site_layout_and_page_project_id
```
Expected: migration created under `backend/prisma/migrations/`, applied cleanly, ends with `Your database is now in sync with your schema.`

- [ ] **Step 4: Regenerate the Prisma client**

Run: `cd backend && npm run db:generate`
Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add prisma/schema/site-layout.prisma prisma/schema/page-builder.prisma prisma/migrations
git commit -m "feat(db): add SiteLayout model and BuilderPage.project_id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Backend `site-layout` module (schema, service, controller, routes)

**Files:**
- Create: `backend/src/modules/site-layout/module.json`
- Create: `backend/src/modules/site-layout/schema.js`
- Create: `backend/src/modules/site-layout/service.js`
- Create: `backend/src/modules/site-layout/controller.js`
- Create: `backend/src/modules/site-layout/routes.js`
- Modify: `backend/src/index.js`
- Test: `backend/tests/site-layout.service.test.js`

- [ ] **Step 1: Write the failing service tests**

Create `backend/tests/site-layout.service.test.js`:

```javascript
// Site Layout service unit tests.
// Covers: getSiteLayout, createSiteLayoutIfMissing, upsertSiteLayout
// (including the backfill-project_id and strip-header/footer-blocks side effects).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, activityMock } = vi.hoisted(() => ({
  prismaMock: {
    siteLayout: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    templateEngineRun: { findMany: vi.fn() },
    builderPage: { updateMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
  activityMock: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: activityMock,
}));

import {
  getSiteLayout,
  createSiteLayoutIfMissing,
  upsertSiteLayout,
} from '../src/modules/site-layout/service.js';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.templateEngineRun.findMany.mockResolvedValue([]);
  prismaMock.builderPage.findMany.mockResolvedValue([]);
  prismaMock.builderPage.updateMany.mockResolvedValue({ count: 0 });
});

describe('getSiteLayout', () => {
  it('returns the row for the project', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue({ id: 'sl1', project_id: 'p1', header: {}, footer: {} });
    const result = await getSiteLayout('p1');
    expect(result.id).toBe('sl1');
    expect(prismaMock.siteLayout.findUnique).toHaveBeenCalledWith({ where: { project_id: 'p1' } });
  });

  it('returns null when no row exists', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(null);
    const result = await getSiteLayout('p1');
    expect(result).toBeNull();
  });
});

describe('createSiteLayoutIfMissing', () => {
  it('creates a row when none exists', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(null);
    prismaMock.siteLayout.create.mockResolvedValue({ id: 'sl1', project_id: 'p1' });
    const result = await createSiteLayoutIfMissing('p1', { header: { brand: 'X' }, footer: { brand: 'X' } });
    expect(prismaMock.siteLayout.create).toHaveBeenCalledWith({
      data: { project_id: 'p1', header: { brand: 'X' }, footer: { brand: 'X' } },
    });
    expect(result.id).toBe('sl1');
  });

  it('does not overwrite an existing row', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue({ id: 'sl1', project_id: 'p1' });
    const result = await createSiteLayoutIfMissing('p1', { header: {}, footer: {} });
    expect(prismaMock.siteLayout.create).not.toHaveBeenCalled();
    expect(result.id).toBe('sl1');
  });
});

describe('upsertSiteLayout', () => {
  it('upserts the row and logs activity', async () => {
    prismaMock.siteLayout.upsert.mockResolvedValue({ id: 'sl1', project_id: 'p1', header: { brand: 'Y' }, footer: {} });
    const result = await upsertSiteLayout('p1', { header: { brand: 'Y' }, footer: {} }, 'user1');
    expect(prismaMock.siteLayout.upsert).toHaveBeenCalledWith({
      where: { project_id: 'p1' },
      update: { header: { brand: 'Y' }, footer: {} },
      create: { project_id: 'p1', header: { brand: 'Y' }, footer: {} },
    });
    expect(result.id).toBe('sl1');
    expect(activityMock).toHaveBeenCalledWith(expect.objectContaining({ module: 'site-layout', action: 'updated' }));
  });

  it('backfills project_id onto pages found via TemplateEngineRun/Stage outputRef', async () => {
    prismaMock.siteLayout.upsert.mockResolvedValue({ id: 'sl1', project_id: 'p1' });
    prismaMock.templateEngineRun.findMany.mockResolvedValue([
      { id: 'run1', stages: [{ stage: 'WEBSITE', outputRef: { pageKeyToId: { home: 'pg1', about: 'pg2' } } }] },
    ]);
    await upsertSiteLayout('p1', { header: {}, footer: {} }, 'user1');
    expect(prismaMock.builderPage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['pg1', 'pg2'] }, project_id: null },
      data: { project_id: 'p1' },
    });
  });

  it('skips the backfill call when no template-engine pages are found', async () => {
    prismaMock.siteLayout.upsert.mockResolvedValue({ id: 'sl1', project_id: 'p1' });
    prismaMock.templateEngineRun.findMany.mockResolvedValue([]);
    await upsertSiteLayout('p1', { header: {}, footer: {} }, 'user1');
    expect(prismaMock.builderPage.updateMany).not.toHaveBeenCalled();
  });

  it('strips NavBar/Footer/MedicalTopNav blocks from every page in the project', async () => {
    prismaMock.siteLayout.upsert.mockResolvedValue({ id: 'sl1', project_id: 'p1' });
    prismaMock.builderPage.findMany.mockResolvedValue([
      {
        id: 'pg1',
        data: {
          root: { props: { title: 'Home' } },
          content: [
            { type: 'MedicalTopNav', props: {} },
            { type: 'MedicalHeroSplit', props: {} },
            { type: 'Footer', props: {} },
          ],
        },
      },
      {
        id: 'pg2',
        data: {
          root: { props: { title: 'About' } },
          content: [{ type: 'NavBar', props: {} }, { type: 'Hero', props: {} }, { type: 'Footer', props: {} }],
        },
      },
    ]);
    await upsertSiteLayout('p1', { header: {}, footer: {} }, 'user1');

    expect(prismaMock.builderPage.update).toHaveBeenCalledWith({
      where: { id: 'pg1' },
      data: { data: expect.objectContaining({ content: [{ type: 'MedicalHeroSplit', props: {} }] }) },
    });
    expect(prismaMock.builderPage.update).toHaveBeenCalledWith({
      where: { id: 'pg2' },
      data: { data: expect.objectContaining({ content: [{ type: 'Hero', props: {} }] }) },
    });
  });

  it('does not touch a page with no header/footer blocks', async () => {
    prismaMock.siteLayout.upsert.mockResolvedValue({ id: 'sl1', project_id: 'p1' });
    prismaMock.builderPage.findMany.mockResolvedValue([
      { id: 'pg1', data: { root: {}, content: [{ type: 'Hero', props: {} }] } },
    ]);
    await upsertSiteLayout('p1', { header: {}, footer: {} }, 'user1');
    expect(prismaMock.builderPage.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && JWT_SECRET=test-secret-32-characters-long-x JWT_REFRESH_SECRET=test-secret-32-characters-long-y npx vitest run tests/site-layout.service.test.js`
Expected: FAIL — `Cannot find module '../src/modules/site-layout/service.js'`

- [ ] **Step 3: Write `schema.js`**

Create `backend/src/modules/site-layout/schema.js`:

```javascript
import { z } from 'zod';

// Header/footer are free-form Puck-style prop bags (variant, brand, logoUrl,
// links, ctaLabel/Href, primaryColor / tagline, copyright) — validate the
// envelope, not the individual fields, same approach as page-builder's
// puckData schema for the same reason (component packs evolve independently).
const layoutProps = z.record(z.any());

export const upsertSiteLayoutSchema = z.object({
  header: layoutProps.optional(),
  footer: layoutProps.optional(),
});
```

- [ ] **Step 4: Write `service.js`**

Create `backend/src/modules/site-layout/service.js`:

```javascript
import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

// Per-page block types superseded by a project's shared SiteLayout once one
// is saved — stripped from every page in the project on each save.
const HEADER_FOOTER_BLOCK_TYPES = new Set(['NavBar', 'Footer', 'MedicalTopNav']);

export const getSiteLayout = async (projectId) => {
  return prisma.siteLayout.findUnique({ where: { project_id: projectId } });
};

// Used by the template-engine website driver at seed time — never overwrites
// a layout a user has already customized.
export const createSiteLayoutIfMissing = async (projectId, { header, footer }) => {
  const existing = await prisma.siteLayout.findUnique({ where: { project_id: projectId } });
  if (existing) return existing;
  return prisma.siteLayout.create({ data: { project_id: projectId, header, footer } });
};

export const upsertSiteLayout = async (projectId, { header, footer }, actorId) => {
  const row = await prisma.siteLayout.upsert({
    where: { project_id: projectId },
    update: { header: header ?? {}, footer: footer ?? {} },
    create: { project_id: projectId, header: header ?? {}, footer: footer ?? {} },
  });

  await backfillPageProjectIds(projectId);
  await stripHeaderFooterBlocks(projectId);

  writeActivityAsync({
    actor: actorId,
    module: 'site-layout',
    action: 'updated',
    subject_type: 'SiteLayout',
    subject_id: row.id,
    description: `Site layout updated for project ${projectId}`,
  });

  return row;
};

// BuilderPage rows seeded before this feature existed have no project_id —
// find them via the TemplateEngineRun/Stage that created them and backfill,
// so they participate in the strip below and in the public renderer's lookup.
async function backfillPageProjectIds(projectId) {
  const runs = await prisma.templateEngineRun.findMany({
    where: { projectId },
    include: { stages: { where: { stage: 'WEBSITE' } } },
  });

  const pageIds = new Set();
  for (const run of runs) {
    for (const stage of run.stages) {
      const map = stage.outputRef?.pageKeyToId ?? {};
      for (const id of Object.values(map)) pageIds.add(id);
    }
  }
  if (pageIds.size === 0) return;

  await prisma.builderPage.updateMany({
    where: { id: { in: [...pageIds] }, project_id: null },
    data: { project_id: projectId },
  });
}

async function stripHeaderFooterBlocks(projectId) {
  const pages = await prisma.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null },
  });

  for (const page of pages) {
    const content = Array.isArray(page.data?.content) ? page.data.content : [];
    const stripped = content.filter((b) => !HEADER_FOOTER_BLOCK_TYPES.has(b?.type));
    if (stripped.length !== content.length) {
      await prisma.builderPage.update({
        where: { id: page.id },
        data: { data: { ...page.data, content: stripped } },
      });
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && JWT_SECRET=test-secret-32-characters-long-x JWT_REFRESH_SECRET=test-secret-32-characters-long-y npx vitest run tests/site-layout.service.test.js`
Expected: PASS (7 tests)

- [ ] **Step 6: Write `controller.js`**

Create `backend/src/modules/site-layout/controller.js`:

```javascript
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { upsertSiteLayoutSchema } from './schema.js';
import * as service from './service.js';

export const getOne = async (req, res, next) => {
  try {
    const layout = await service.getSiteLayout(req.params.projectId);
    successResponse(res, { layout });
  } catch (err) {
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const patch = upsertSiteLayoutSchema.parse(req.body);
    const layout = await service.upsertSiteLayout(req.params.projectId, patch, req.user?.id);
    successResponse(res, { layout });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
```

- [ ] **Step 7: Write `routes.js`**

Create `backend/src/modules/site-layout/routes.js`:

```javascript
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getOne, putUpdate } from './controller.js';

const router = Router();

// Public read — consumed by the /p/[slug] renderer and the template-engine
// "view all pages" admin preview.
router.get('/public/:projectId', getOne);

// Editor — authenticated + RBAC-gated, reuses the page-builder permission
// (a site's layout is part of its pages, not a separate resource).
router.get('/:projectId', authenticate, requirePermission('page-builder', 'view'), getOne);
router.put('/:projectId', authenticate, requirePermission('page-builder', 'edit'), putUpdate);

export default router;
```

- [ ] **Step 8: Add `module.json`**

Create `backend/src/modules/site-layout/module.json`:

```json
{
  "slug": "site-layout",
  "name": "Site Layout",
  "version": "1.0.0",
  "description": "Shared header/footer configuration per project — always-on",
  "core": true,
  "visibleInCatalog": false,
  "apiPrefix": "/api/site-layout",
  "permissions": ["page-builder"],
  "nav": [],
  "dependsOn": [],
  "conflictsWith": [],
  "queues": [],
  "env": []
}
```

- [ ] **Step 9: Mount the routes**

In `backend/src/index.js`, add the import near `pageBuilderRoutes` (line 39):

```javascript
import pageBuilderRoutes from './modules/page-builder/routes.js';
import siteLayoutRoutes from './modules/site-layout/routes.js';
```

And mount it next to `/api/page-builder` (line 128):

```javascript
app.use('/api/page-builder', pageBuilderRoutes);
app.use('/api/site-layout', siteLayoutRoutes);
```

- [ ] **Step 10: Run the full backend test suite**

Run: `cd backend && JWT_SECRET=test-secret-32-characters-long-x JWT_REFRESH_SECRET=test-secret-32-characters-long-y npm test`
Expected: PASS, no regressions

- [ ] **Step 11: Commit**

```bash
cd backend
git add src/modules/site-layout src/index.js tests/site-layout.service.test.js
git commit -m "feat(site-layout): add backend module for shared header/footer config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Wire `project_id` through page-builder's `createPage` + public read

**Files:**
- Modify: `backend/src/modules/page-builder/service.js`

- [ ] **Step 1: Update `createPage` to accept `project_id`**

In `backend/src/modules/page-builder/service.js`, replace the `createPage` function:

```javascript
export const createPage = async ({ title, slug, data, project_id }, actorId) => {
  const page = await prisma.builderPage.create({
    data: {
      title,
      slug,
      status: 'DRAFT',
      data: data ?? { root: { props: { title } }, content: [], zones: {} },
      project_id: project_id ?? null,
      created_by: actorId,
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
```

- [ ] **Step 2: Select `project_id` in the public read**

In the same file, update `getPublishedBySlug`:

```javascript
export const getPublishedBySlug = async (slug) => {
  return prisma.builderPage.findFirst({
    where: { slug, status: 'PUBLISHED', deleted_at: null },
    select: { slug: true, title: true, data: true, project_id: true },
  });
};
```

- [ ] **Step 3: Run the backend test suite**

Run: `cd backend && JWT_SECRET=test-secret-32-characters-long-x JWT_REFRESH_SECRET=test-secret-32-characters-long-y npm test`
Expected: PASS, no regressions (no existing test exercises this module — this is a manual-verification step, confirmed later in Task 8's end-to-end walkthrough)

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/modules/page-builder/service.js
git commit -m "feat(page-builder): thread project_id through createPage and public read

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Template-engine seeding — stop baking nav into pages, seed `SiteLayout` instead

**Files:**
- Modify: `backend/src/modules/template-engine/drivers/website-seed-content.js`
- Modify: `backend/src/modules/template-engine/drivers/index.js`

- [ ] **Step 1: Export `navBarProps`/`footerProps`, drop nav from seeded page content**

In `backend/src/modules/template-engine/drivers/website-seed-content.js`:

Add `export` to the two existing function declarations (currently private):

```javascript
export function navBarProps(brand = {}) {
```
```javascript
export function footerProps(brand = {}) {
```

Replace `headerBlocks` (renamed — it no longer includes nav, only the page's own hero) and `seedWebsitePageData`:

```javascript
// Home's hero (medical pack's MedicalHeroSplit) vs. about/contact's general
// Hero — nav is no longer part of this; it now lives in the project's
// shared SiteLayout (see websiteDriver in drivers/index.js).
function heroBlocks(pageKey, brand) {
  if (pageKey === 'home') {
    return [block(pageKey, 'MedicalHeroSplit', homeHeroProps(brand))];
  }
  return [block(pageKey, 'Hero', HERO_BY_KEY[pageKey] ?? HERO_BY_KEY.home)];
}

export function seedWebsitePageData(pageKey, pageTitle, brand = {}) {
  const buildMiddle = MIDDLE_BLOCK_BY_KEY[pageKey] ?? MIDDLE_BLOCK_BY_KEY.home;
  const content = [...heroBlocks(pageKey, brand), buildMiddle(pageKey)];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
```

- [ ] **Step 2: Drop nav/footer from the medical seeder**

Replace `seedMedicalPageData`:

```javascript
export function seedMedicalPageData(pageKey, pageTitle, brand = {}) {
  const buildMiddle = MEDICAL_MIDDLE_BY_KEY[pageKey] ?? MEDICAL_MIDDLE_BY_KEY.home;
  const content = [
    block(pageKey, 'MedicalHero', MEDICAL_HERO_BY_KEY[pageKey] ?? MEDICAL_HERO_BY_KEY.home),
    ...buildMiddle(pageKey),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
```

- [ ] **Step 3: Drop nav/footer from the construction seeder**

Replace `seedConstructionPageData`:

```javascript
export function seedConstructionPageData(pageKey, pageTitle, brand = {}) {
  const buildMiddle = CONSTRUCTION_MIDDLE_BY_KEY[pageKey] ?? CONSTRUCTION_MIDDLE_BY_KEY.home;
  const content = [
    block(
      pageKey,
      'ConstructionHero',
      CONSTRUCTION_HERO_BY_KEY[pageKey] ?? CONSTRUCTION_HERO_BY_KEY.home
    ),
    ...buildMiddle(pageKey),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
```

- [ ] **Step 4: Seed a `SiteLayout` row and pass `project_id` in `websiteDriver`**

In `backend/src/modules/template-engine/drivers/index.js`:

Add to the imports (near line 36-40):

```javascript
import { createPage, getPage } from '../../page-builder/service.js';
import { createSiteLayoutIfMissing } from '../../site-layout/service.js';
import {
  seedWebsitePageData,
  seedMedicalPageData,
  seedConstructionPageData,
  navBarProps,
  footerProps,
} from './website-seed-content.js';
```

Update `websiteDriver.execute` (lines 287-321):

```javascript
const websiteDriver = {
  async execute({ run, stageRecord, userId, templatePack }) {
    const seed = SEEDER_BY_PACK[templatePack] ?? seedWebsitePageData;
    const brand = await resolveWebsiteBrand(run.projectId, userId);

    // Crash recovery (TEMPLATE_ENGINE_ARCH §4.1): reuse pages from a prior attempt.
    const priorMap = stageRecord?.outputRef?.pageKeyToId ?? {};
    const pageKeyToId = {};
    const pageIds = [];

    for (const { key, title } of WEBSITE_SEED_PAGES) {
      const priorId = priorMap[key];
      let existing = null;
      if (priorId) {
        existing = await getPage(priorId).catch(() => null);
      }

      const page = existing ?? await createPage(
        { title, slug: `te-${run.id}-${key}`, data: seed(key, title, brand), project_id: run.projectId },
        userId,
      );

      pageKeyToId[key] = page.id;
      pageIds.push(page.id);
    }

    // Shared header/footer for every page in this project — created once;
    // never overwritten by a re-run (createSiteLayoutIfMissing).
    await createSiteLayoutIfMissing(run.projectId, {
      header: navBarProps(brand),
      footer: footerProps(brand),
    });

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

- [ ] **Step 5: Run the backend test suite**

Run: `cd backend && JWT_SECRET=test-secret-32-characters-long-x JWT_REFRESH_SECRET=test-secret-32-characters-long-y npm test`
Expected: PASS, no regressions

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/modules/template-engine/drivers/website-seed-content.js src/modules/template-engine/drivers/index.js
git commit -m "feat(template-engine): seed SiteLayout instead of baking nav/footer per page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — extract shared `NavBarView`/`FooterView`

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/general/pipe-lines.ts`
- Create: `frontend/src/app/admin/page-builder/packs/general/layout-components.tsx`
- Modify: `frontend/src/app/admin/page-builder/packs/general/index.tsx`

- [ ] **Step 1: Extract the pipe-line parsing helpers**

Create `frontend/src/app/admin/page-builder/packs/general/pipe-lines.ts`:

```typescript
// Shared by every pack that stores repeatable rows as pipe-delimited lines
// (NavBar/Footer links, StatsStrip stats, FeatureCards cards, etc.) and by
// the standalone NavBarView/FooterView used outside the Puck component tree
// (site-wide layout render — see layout-components.tsx).

export function parseLine<T>(raw: string, parser: (line: string) => T | null): T[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parser)
    .filter((v): v is T => v !== null)
}

export function parsePipeLines(raw: string, fieldCount: number): string[][] {
  return parseLine(raw, (line) => {
    const parts = line.split('|').map((p) => p.trim())
    return parts.length >= fieldCount ? parts : null
  })
}
```

- [ ] **Step 2: Create `layout-components.tsx` with `NavBarView`/`FooterView`**

Create `frontend/src/app/admin/page-builder/packs/general/layout-components.tsx` (render bodies copied verbatim from the current `NavBar`/`Footer` Puck block `render` functions):

```tsx
import { parsePipeLines } from './pipe-lines'

/**
 * Pure render components for the site-wide header/footer — used both as the
 * Puck `NavBar`/`Footer` block bodies (one-off per-page overrides) and by the
 * shared-layout renderers (public /p/[slug], template-engine site preview),
 * fed from the project's SiteLayout instead of page content.
 */

export interface NavBarViewProps {
  variant: '1' | '2' | '3' | '4'
  brand: string
  logoUrl: string
  links: string
  ctaLabel: string
  ctaHref: string
  primaryColor: string
}

export function NavBarView({
  variant,
  brand,
  logoUrl,
  links,
  ctaLabel,
  ctaHref,
  primaryColor,
}: NavBarViewProps) {
  const rows = parsePipeLines(links, 2)
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={brand} className="h-8 w-8 rounded object-contain" />
  ) : null
  const cta = ctaLabel ? (
    <a
      href={ctaHref}
      style={primaryColor ? { backgroundColor: primaryColor } : undefined}
      className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
    >
      {ctaLabel}
    </a>
  ) : null

  if (variant === '2') {
    return (
      <header className="flex flex-col items-center gap-3 border-b border-slate-200 px-6 py-4">
        <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {logo}
          {brand}
        </span>
        <nav className="flex flex-wrap items-center justify-center gap-6">
          {rows.map(([label, href], i) => (
            <a key={i} href={href} className="text-sm font-medium text-slate-700 hover:text-blue-600">
              {label}
            </a>
          ))}
          {cta}
        </nav>
      </header>
    )
  }
  if (variant === '3') {
    return (
      <header className="flex items-center justify-between gap-6 bg-slate-900 px-6 py-4">
        <span className="flex items-center gap-2 text-lg font-bold text-white">
          {logo}
          {brand}
        </span>
        <nav className="hidden md:flex items-center gap-6">
          {rows.map(([label, href], i) => (
            <a key={i} href={href} className="text-sm font-medium text-slate-300 hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        {cta}
      </header>
    )
  }
  if (variant === '4') {
    return (
      <header className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-4">
        <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {logo}
          {brand}
        </span>
        {cta}
      </header>
    )
  }
  return (
    <header className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-4">
      <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
        {logo}
        {brand}
      </span>
      <nav className="hidden md:flex items-center gap-6">
        {rows.map(([label, href], i) => (
          <a key={i} href={href} className="text-sm font-medium text-slate-700 hover:text-blue-600">
            {label}
          </a>
        ))}
      </nav>
      {cta}
    </header>
  )
}

export interface FooterViewProps {
  variant: '1' | '2' | '3' | '4'
  brand: string
  logoUrl: string
  tagline: string
  links: string
  copyright: string
}

export function FooterView({ variant, brand, logoUrl, tagline, links, copyright }: FooterViewProps) {
  const rows = parsePipeLines(links, 2)
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={brand} className="h-7 w-7 rounded object-contain" />
  ) : null

  if (variant === '2') {
    return (
      <footer className="bg-slate-900 px-6 py-10 text-center text-slate-300">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            {logo}
            {brand}
          </div>
          <p className="text-sm text-slate-400">{tagline}</p>
          <nav className="flex gap-6">
            {rows.map(([label, href], i) => (
              <a key={i} href={href} className="text-sm hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-4 w-full border-t border-slate-800 pt-6 text-xs text-slate-500">
            {copyright}
          </div>
        </div>
      </footer>
    )
  }
  if (variant === '3') {
    return (
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-10 text-slate-600">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {logo}
              {brand}
            </div>
            <p className="mt-1 text-sm text-slate-500">{tagline}</p>
          </div>
          <nav className="flex gap-6">
            {rows.map(([label, href], i) => (
              <a key={i} href={href} className="text-sm hover:text-slate-900">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mx-auto mt-8 max-w-5xl border-t border-slate-200 pt-6 text-xs text-slate-400">
          {copyright}
        </div>
      </footer>
    )
  }
  if (variant === '4') {
    return (
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-6 text-sm text-slate-500">
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          {logo}
          {brand}
        </span>
        <span>{copyright}</span>
      </footer>
    )
  }
  return (
    <footer className="bg-slate-900 px-6 py-10 text-slate-300">
      <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            {logo}
            {brand}
          </div>
          <p className="mt-1 text-sm text-slate-400">{tagline}</p>
        </div>
        <nav className="flex gap-6">
          {rows.map(([label, href], i) => (
            <a key={i} href={href} className="text-sm hover:text-white">
              {label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-8 max-w-5xl border-t border-slate-800 pt-6 text-xs text-slate-500">
        {copyright}
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Wire `index.tsx` to the extracted code**

In `frontend/src/app/admin/page-builder/packs/general/index.tsx`:

Replace the import block (top of file) — add:
```tsx
import { parsePipeLines } from './pipe-lines'
import { NavBarView, FooterView } from './layout-components'
```

Delete the local `parseLine`/`parsePipeLines` definitions (the block currently at lines 72-88, the "Shared helpers" comment through the closing brace of `parsePipeLines`).

Rename the `layout` category (avoids colliding with the new editor tab also named "Layout" — Puck's block category and the plugin tab are different concepts but share the same word today):
```tsx
const typedCategories: NonNullable<Config<GeneralProps>['categories']> = {
  structure: { title: 'Structure', components: ['Section', 'Columns', 'Spacer', 'NavBar', 'Footer'] },
  content: {
    title: 'Content',
    components: ['Hero', 'Heading', 'Text', 'Button', 'Image', 'StatsStrip', 'FeatureCards'],
  },
}
```

Replace the `NavBar` component's `render` function (the whole body from `render: ({ variant, brand, logoUrl, links, ctaLabel, ctaHref, primaryColor }) => {` through its closing `},`) with:
```tsx
    render: (props) => <NavBarView {...props} />,
```

Replace the `Footer` component's `render` function similarly with:
```tsx
    render: (props) => <FooterView {...props} />,
```

- [ ] **Step 4: Typecheck and lint**

Run: `cd frontend && pnpm type-check && pnpm lint`
Expected: both PASS, no errors

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/app/admin/page-builder/packs/general/pipe-lines.ts src/app/admin/page-builder/packs/general/layout-components.tsx src/app/admin/page-builder/packs/general/index.tsx
git commit -m "refactor(page-builder): extract NavBarView/FooterView for reuse outside Puck

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Frontend — `site-layout-store.ts` + `PageRecord.projectId`

**Files:**
- Create: `frontend/src/app/admin/page-builder/site-layout-store.ts`
- Modify: `frontend/src/app/admin/page-builder/store.ts`

- [ ] **Step 1: Create the site-layout API wrapper**

Create `frontend/src/app/admin/page-builder/site-layout-store.ts`:

```typescript
import api from '@/lib/axios'
import type { NavBarViewProps, FooterViewProps } from './packs/general/layout-components'

/**
 * Backend persistence layer for the project-scoped shared Layout (header/
 * footer). Mirrors store.ts's shape.
 *
 * Routes:
 *   getSiteLayout(projectId)        -> GET /site-layout/:projectId        (authenticated)
 *   saveSiteLayout(projectId, data) -> PUT /site-layout/:projectId        (authenticated)
 *   getSiteLayoutPublic(projectId)  -> GET /site-layout/public/:projectId (no auth)
 */

export interface SiteLayoutRecord {
  header: NavBarViewProps
  footer: FooterViewProps
}

export const DEFAULT_HEADER: NavBarViewProps = {
  variant: '1',
  brand: 'Your Brand',
  logoUrl: '',
  links: ['Home|#', 'About|#', 'Contact|#'].join('\n'),
  ctaLabel: 'Get Started',
  ctaHref: '#',
  primaryColor: '',
}

export const DEFAULT_FOOTER: FooterViewProps = {
  variant: '1',
  brand: 'Your Brand',
  logoUrl: '',
  tagline: 'Building something great.',
  links: ['Home|#', 'About|#', 'Contact|#'].join('\n'),
  copyright: `© ${new Date().getFullYear()} Your Brand. All rights reserved.`,
}

function withDefaults(
  raw: { header?: Partial<NavBarViewProps>; footer?: Partial<FooterViewProps> } | null | undefined
): SiteLayoutRecord {
  return {
    header: { ...DEFAULT_HEADER, ...(raw?.header ?? {}) },
    footer: { ...DEFAULT_FOOTER, ...(raw?.footer ?? {}) },
  }
}

export async function getSiteLayout(projectId: string): Promise<SiteLayoutRecord> {
  const res = await api.get(`/site-layout/${projectId}`)
  return withDefaults(res.data.data.layout)
}

export async function saveSiteLayout(
  projectId: string,
  patch: SiteLayoutRecord
): Promise<SiteLayoutRecord> {
  const res = await api.put(`/site-layout/${projectId}`, patch)
  return withDefaults(res.data.data.layout)
}

export async function getSiteLayoutPublic(projectId: string): Promise<SiteLayoutRecord | undefined> {
  try {
    const res = await api.get(`/site-layout/public/${projectId}`)
    return withDefaults(res.data.data.layout)
  } catch {
    return undefined
  }
}
```

- [ ] **Step 2: Add `projectId` to `PageRecord`**

In `frontend/src/app/admin/page-builder/store.ts`, update the interface and mapper:

```typescript
export interface PageRecord {
  id: string
  slug: string
  title: string
  data: Data
  status: 'DRAFT' | 'PUBLISHED'
  updatedAt: string
  projectId: string | null
}

type ListItem = Omit<PageRecord, 'data'> & { updated_at: string; project_id?: string | null }

function toRecord(raw: ListItem & { data?: Data }): PageRecord {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    data: raw.data ?? ({ ...emptyData, root: { props: { title: raw.title } } } as Data),
    status: raw.status,
    updatedAt: raw.updated_at,
    projectId: raw.project_id ?? null,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/app/admin/page-builder/site-layout-store.ts src/app/admin/page-builder/store.ts
git commit -m "feat(page-builder): add site-layout API client and PageRecord.projectId

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Frontend — `LayoutPanel` + wire the third editor tab

**Files:**
- Create: `frontend/src/app/admin/template-engine/edit/[id]/_components/LayoutPanel.tsx`
- Modify: `frontend/src/app/admin/template-engine/edit/[id]/page.tsx`

- [ ] **Step 1: Create `LayoutPanel.tsx`**

Create `frontend/src/app/admin/template-engine/edit/[id]/_components/LayoutPanel.tsx`:

```tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import {
  getSiteLayout,
  saveSiteLayout,
  DEFAULT_HEADER,
  DEFAULT_FOOTER,
  type SiteLayoutRecord,
} from '../../../../page-builder/site-layout-store'
import type { NavBarViewProps, FooterViewProps } from '../../../../page-builder/packs/general/layout-components'

/**
 * Puck plugin panel for the "Layout" tab — configures the project's shared
 * Header/Footer once, applied to every page in the project (KDL: shared
 * site layout). Reads `projectId` itself from the URL rather than relying on
 * Puck's plugin `render` prop signature, so it works regardless of what (if
 * anything) Puck passes to plugin panels.
 */
export function LayoutPanel() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['site-layout', projectId],
    queryFn: () => getSiteLayout(projectId as string),
    enabled: !!projectId,
  })

  const [header, setHeader] = useState<NavBarViewProps>(DEFAULT_HEADER)
  const [footer, setFooter] = useState<FooterViewProps>(DEFAULT_FOOTER)

  useEffect(() => {
    if (data) {
      setHeader(data.header)
      setFooter(data.footer)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => saveSiteLayout(projectId as string, { header, footer }),
    onSuccess: (saved: SiteLayoutRecord) => {
      setHeader(saved.header)
      setFooter(saved.footer)
      void qc.invalidateQueries({ queryKey: ['site-layout', projectId] })
      toast({ title: 'Saved', description: 'Layout applied to every page in this project.' })
    },
    onError: () =>
      toast({ title: 'Save failed', description: 'Could not save the layout.', variant: 'destructive' }),
  })

  if (!projectId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This page has no project — Layout only applies to pages created via the template engine.
      </div>
    )
  }
  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Header</h3>
        <Field label="Variant">
          <select
            className={inputCls}
            value={header.variant}
            onChange={(e) =>
              setHeader({ ...header, variant: e.target.value as NavBarViewProps['variant'] })
            }
          >
            <option value="1">Brand + links + CTA</option>
            <option value="2">Centered, stacked</option>
            <option value="3">Dark</option>
            <option value="4">Minimal</option>
          </select>
        </Field>
        <Field label="Brand">
          <input
            className={inputCls}
            value={header.brand}
            onChange={(e) => setHeader({ ...header, brand: e.target.value })}
          />
        </Field>
        <Field label="Logo URL">
          <input
            className={inputCls}
            value={header.logoUrl}
            onChange={(e) => setHeader({ ...header, logoUrl: e.target.value })}
          />
        </Field>
        <Field label="Links (Label|Href per line)">
          <textarea
            className={inputCls}
            rows={3}
            value={header.links}
            onChange={(e) => setHeader({ ...header, links: e.target.value })}
          />
        </Field>
        <Field label="CTA label">
          <input
            className={inputCls}
            value={header.ctaLabel}
            onChange={(e) => setHeader({ ...header, ctaLabel: e.target.value })}
          />
        </Field>
        <Field label="CTA href">
          <input
            className={inputCls}
            value={header.ctaHref}
            onChange={(e) => setHeader({ ...header, ctaHref: e.target.value })}
          />
        </Field>
        <Field label="Primary color">
          <input
            className={inputCls}
            value={header.primaryColor}
            onChange={(e) => setHeader({ ...header, primaryColor: e.target.value })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Footer</h3>
        <Field label="Variant">
          <select
            className={inputCls}
            value={footer.variant}
            onChange={(e) =>
              setFooter({ ...footer, variant: e.target.value as FooterViewProps['variant'] })
            }
          >
            <option value="1">Split, dark</option>
            <option value="2">Centered, dark</option>
            <option value="3">Split, light</option>
            <option value="4">Minimal</option>
          </select>
        </Field>
        <Field label="Brand">
          <input
            className={inputCls}
            value={footer.brand}
            onChange={(e) => setFooter({ ...footer, brand: e.target.value })}
          />
        </Field>
        <Field label="Logo URL">
          <input
            className={inputCls}
            value={footer.logoUrl}
            onChange={(e) => setFooter({ ...footer, logoUrl: e.target.value })}
          />
        </Field>
        <Field label="Tagline">
          <input
            className={inputCls}
            value={footer.tagline}
            onChange={(e) => setFooter({ ...footer, tagline: e.target.value })}
          />
        </Field>
        <Field label="Links (Label|Href per line)">
          <textarea
            className={inputCls}
            rows={3}
            value={footer.links}
            onChange={(e) => setFooter({ ...footer, links: e.target.value })}
          />
        </Field>
        <Field label="Copyright">
          <input
            className={inputCls}
            value={footer.copyright}
            onChange={(e) => setFooter({ ...footer, copyright: e.target.value })}
          />
        </Field>
      </section>

      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saveMutation.isPending ? 'Saving…' : 'Save layout'}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

const inputCls = 'w-full rounded-md border px-2 py-1.5 text-sm text-foreground'
```

- [ ] **Step 2: Add the plugin to the Puck editor**

In `frontend/src/app/admin/template-engine/edit/[id]/page.tsx`, add the import:

```tsx
import { LayoutPanel } from './_components/LayoutPanel'
```

Add `plugins` to the `<Puck>` element (alongside the existing `overrides` prop):

```tsx
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
          onPublish={(data: Data) => saveMutation.mutate(data)}
          plugins={[{ name: 'layout', label: 'Layout', render: LayoutPanel }]}
          overrides={{
            headerActions: ({ children }) => (
              <>
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  <ArrowLeft size={15} /> Back
                </Link>
                {children}
              </>
            ),
          }}
        />
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd frontend && pnpm type-check && pnpm lint`
Expected: both PASS

- [ ] **Step 4: Manual verification**

Run: `cd backend && npm run dev` (separate terminal) and `cd frontend && pnpm dev`, then open `/admin/template-engine/edit/<pageId>?projectId=<projectId>` for an existing seeded page.
Expected: a third "Layout" tab appears next to Blocks/Outline in the left sidebar; clicking it shows Header/Footer forms pre-filled from the project's seeded `navBarProps`/`footerProps`; editing a field and clicking "Save layout" shows the "Saved" toast.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add "src/app/admin/template-engine/edit/[id]/_components/LayoutPanel.tsx" "src/app/admin/template-engine/edit/[id]/page.tsx"
git commit -m "feat(template-engine): add Layout tab for shared header/footer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Frontend — apply the shared layout on both renderers

**Files:**
- Modify: `frontend/src/app/p/[slug]/page.tsx`
- Modify: `frontend/src/app/admin/template-engine/site/page.tsx`

- [ ] **Step 1: Wrap the public renderer**

Replace `frontend/src/app/p/[slug]/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { config } from '@/app/admin/page-builder/puck.config'
import { getPageBySlug } from '@/app/admin/page-builder/store'
import { getSiteLayoutPublic } from '@/app/admin/page-builder/site-layout-store'
import { NavBarView, FooterView } from '@/app/admin/page-builder/packs/general/layout-components'

/**
 * Public, responsive renderer for a published page.
 *
 * Uses the SAME `config` as the editor so what an admin builds is exactly what
 * a visitor sees. Fetches from the backend's public route (no auth required) —
 * only PUBLISHED pages are returned. Header/Footer come from the page's
 * project-wide SiteLayout, not the page's own content — see KDL Layout tab.
 */
export default function PublicPage() {
  const params = useParams<{ slug: string }>()

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-page', params.slug],
    queryFn: () => getPageBySlug(params.slug),
    retry: false,
  })

  const { data: layout } = useQuery({
    queryKey: ['site-layout-public', page?.projectId],
    queryFn: () => getSiteLayoutPublic(page!.projectId as string),
    enabled: !!page?.projectId,
  })

  if (isLoading) return <div className="min-h-screen" />

  if (isError || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>404 — no published page at /p/{params.slug}</p>
      </div>
    )
  }

  return (
    <>
      {layout && <NavBarView {...layout.header} />}
      <Render config={config} data={page.data} />
      {layout && <FooterView {...layout.footer} />}
    </>
  )
}
```

- [ ] **Step 2: Wrap the admin "view all pages" preview**

In `frontend/src/app/admin/template-engine/site/page.tsx`, add imports:

```tsx
import { getSiteLayoutPublic } from '../../page-builder/site-layout-store'
import { NavBarView, FooterView } from '../../page-builder/packs/general/layout-components'
```

Add a query below the existing `useBrandKit` call (this route already reads `projectId` from `searchParams` at line 31):

```tsx
  const { data: layout } = useQuery({
    queryKey: ['site-layout-public', projectId],
    queryFn: () => getSiteLayoutPublic(projectId as string),
    enabled: !!projectId,
  })
```

Note: `useQuery` needs importing alongside the existing `useQueries` import — update:
```tsx
import { useQueries, useQuery } from '@tanstack/react-query'
```

Wrap the rendered page (replace the `<Render key={active.id} config={config} data={active.data} />` line):

```tsx
            <>
              {layout && <NavBarView {...layout.header} />}
              <Render key={active.id} config={config} data={active.data} />
              {layout && <FooterView {...layout.footer} />}
            </>
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `cd frontend && pnpm type-check && pnpm lint && pnpm build`
Expected: all PASS

- [ ] **Step 4: Manual end-to-end verification**

With `backend`/`frontend` dev servers running:
1. Open the Layout tab for a seeded project's Home page, confirm it loads the seeded header/footer, change the header's Brand field, click "Save layout".
2. Reload the Home page's editor canvas — confirm the old baked-in `MedicalTopNav`/`Footer` blocks are gone from the canvas (stripped by the save) and only the page's own hero/body blocks remain.
3. Publish the page (Puck's own Publish button) and open `/p/<slug>` in a new tab — confirm the shared header (with the edited Brand) and footer render around the page content, with no duplicate header.
4. Open `/admin/template-engine/site?ids=<id1>,<id2>&projectId=<projectId>` — confirm the same shared header/footer wraps whichever page is active and switching pages (clicking a nav link) still works.

Expected: no duplicate headers/footers anywhere, edited values reflected everywhere, page-switching in the site preview still works.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add "src/app/p/[slug]/page.tsx" "src/app/admin/template-engine/site/page.tsx"
git commit -m "feat(template-engine): render shared SiteLayout header/footer on published pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Data model (Task 1), backend CRUD + strip/backfill (Task 2), `project_id` plumbing (Task 3), seeding change (Task 4), shared render extraction (Task 5), frontend API client (Task 6), editor tab (Task 7), public/preview rendering (Task 8) — all spec sections have a task.
- **MedicalTopNav gap caught during investigation:** the spec's "strip NavBar/Footer" language undersold it — Home's seeded header block is actually `MedicalTopNav`, not `NavBar`. `HEADER_FOOTER_BLOCK_TYPES` in Task 2 includes all three (`NavBar`, `Footer`, `MedicalTopNav`) so Home doesn't end up with a duplicate header after the first Layout save. Confirmed via `packs/medical/index.tsx` that there is no separate medical footer variant.
- **No new RBAC permission**: reuses `page-builder`'s `view`/`edit` actions throughout.
