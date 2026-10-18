# KDL Starter Kit — Current Issues & Exact Solutions (Ranked High to Low)

**Generated on:** 2026-10-05  
**Target Repository:** `/Users/f9developer/Documents/Claude/Projects/F9 Tech/kdl-starter-kit`  
**Current Git Branch:** `feat/single-origin-site-array-items`  
**Ordering:** Strict **HIGH to LOW** severity (P0 Critical → P1 High → P2 Medium → P3 Low)

---

## Table of Contents
1. [High to Low Priority Matrix](#high-to-low-priority-matrix)
2. [TIER 1: CRITICAL / P0 ISSUES (Highest Priority — CI/Build Blockers)](#tier-1-critical--p0-issues-highest-priority--cibuild-blockers)
   - [Issue 1: Backend Website Driver Test Mock Out-of-Sync (19 Failures)](#issue-1-backend-website-driver-test-mock-out-of-sync-19-failures)
   - [Issue 2: Backend Catalog Seed-Content Test Unmocked DB (1 Failure)](#issue-2-backend-catalog-seed-content-test-unmocked-db-1-failure)
   - [Issue 3: Frontend Website Stage RTL Test Stale String Match (1 Failure)](#issue-3-frontend-website-stage-rtl-test-stale-string-match-1-failure)
   - [Issue 4: Frontend Construction Pack Unregistered Variants (3 Failures)](#issue-4-frontend-construction-pack-unregistered-variants-3-failures)
3. [TIER 2: HIGH / P1 ISSUES (High Priority — Data Loss & Broken User Navigation)](#tier-2-high--p1-issues-high-priority--data-loss--broken-user-navigation)
   - [Issue 5: Zero Auto-Save in Puck Visual Page Builder (Work Loss on Refresh)](#issue-5-zero-auto-save-in-puck-visual-page-builder-work-loss-on-refresh)
   - [Issue 6: Mobile Navigation Drawer Lacks 3-Level Menu Hierarchy](#issue-6-mobile-navigation-drawer-lacks-3-level-menu-hierarchy)
   - [Issue 7: ConstructionHeader Designs 2, 3, 4 Fall Back to Static Links](#issue-7-constructionheader-designs-2-3-4-fall-back-to-static-links)
4. [TIER 3: MEDIUM / P2 ISSUES (Medium Priority — Architecture & Search Visibility)](#tier-3-medium--p2-issues-medium-priority--architecture--search-visibility)
   - [Issue 8: Missing Server-Side `generateMetadata` on Dynamic Sector Pages](#issue-8-missing-server-side-generatemetadata-on-dynamic-sector-pages)
   - [Issue 9: Global `setting-fields` Lacks `project_id` Multi-Tenancy Scoping](#issue-9-global-setting-fields-lacks-project_id-multi-tenancy-scoping)
5. [TIER 4: LOW / P3 ISSUES (Low Priority — Dependencies & Staging Cloud Setup)](#tier-4-low--p3-issues-low-priority--dependencies--staging-cloud-setup)
   - [Issue 10: Dependabot Lockfile Backlog & Version Conflicts (14 Open PRs)](#issue-10-dependabot-lockfile-backlog--version-conflicts-14-open-prs)
   - [Issue 11: Remote Staging VPS Deployment Pending Cloud Provisioning](#issue-11-remote-staging-vps-deployment-pending-cloud-provisioning)
6. [Step-by-Step High-to-Low Execution Roadmap](#step-by-step-high-to-low-execution-roadmap)


## High to Low Priority Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│  P0 CRITICAL (4 Issues)  ──▶  CI/CD Blockers, Failing Tests            │
│  P1 HIGH     (3 Issues)  ──▶  Data Loss Risk, Broken Mobile Navigation │
│  P2 MEDIUM   (2 Issues)  ──▶  SEO Crawlability, Multi-Tenancy Scoping  │
│  P3 LOW      (2 Issues)  ──▶  Dependabot PRs, Remote Staging VPS Host  │
└────────────────────────────────────────────────────────────────────────┘
```

| Rank | Issue ID | Severity | File / Module | Impact | Action Required |
|:---:|---|:---:|---|---|---|
| **1** | **Issue 1** | **P0 CRITICAL** | `backend/.../website.driver.test.js` | 19 backend tests fail in CI | Mock `updatePage` to return `{ id, ...patch }` |
| **2** | **Issue 2** | **P0 CRITICAL** | `backend/.../seed-content.test.js` | 1 backend test fails without DB | Mock `database.js` in pure unit test |
| **3** | **Issue 3** | **P0 CRITICAL** | `frontend/.../template-engine-website-stage.test.tsx` | 1 frontend test fails in CI | Update RTL text query from exact to regex |
| **4** | **Issue 4** | **P0 CRITICAL** | `frontend/.../construction/index.tsx` | 3 frontend tests fail in CI | Register 3 missing blocks in `variants` |
| **5** | **Issue 5** | **P1 HIGH** | `frontend/.../template-engine/edit/[id]/page.tsx` | Data loss on browser refresh | Add 1500ms debounced autosave + unload guard |
| **6** | **Issue 6** | **P1 HIGH** | `frontend/.../header-nav-menu.tsx` | Mobile visitors cannot see sub-menus | Wire 3-level menu tree to mobile drawer |
| **7** | **Issue 7** | **P1 HIGH** | `frontend/.../packs/construction/index.tsx` | Header D2-D4 revert to static links | Replace flat link strings with `HeaderNavMenu` |
| **8** | **Issue 8** | **P2 MEDIUM** | `frontend/src/app/sectors/[slug]/page.tsx` | Search crawlers miss metadata | Implement Next.js `generateMetadata` Server Component |
| **9** | **Issue 9** | **P2 MEDIUM** | `backend/prisma/schema/core.prisma` | Vision/Mission copy shared across all projects | Add `project_id` column to `SettingValue` |
| **10**| **Issue 10**| **P3 LOW** | `backend/package.json`, `frontend/package.json` | 14 PRs accumulating on GitHub | Audit fix & regenerate clean lockfiles |
| **11**| **Issue 11**| **P3 LOW** | `MANUAL_TASKS.md` (§KDL-403) | Staging URL not live on public internet | Provision $6/mo VPS and set `STAGING_HOST` |

---

## TIER 1: CRITICAL / P0 ISSUES (Highest Priority — CI/Build Blockers)

---

### Issue 1: Backend Website Driver Test Mock Out-of-Sync (19 Failures)

* **Severity:** P0 CRITICAL (Blocks backend test runner and CI pipeline)
* **File:** `backend/src/modules/template-engine/drivers/website.driver.test.js`
* **Trigger:** Commit `633ebb2` added automatic publishing of newly created pages.

#### Problem
In `backend/src/modules/template-engine/drivers/index.js`, `websiteDriver.execute()` calls:
```javascript
// drivers/index.js:460-463
page = await updatePage(page.id, { status: 'PUBLISHED' }, userId);
pageKeyToId[key] = page.id;
```
In `website.driver.test.js`, `updatePage` is mocked as a bare `vi.fn()`:
```javascript
vi.mock('../../page-builder/service.js', () => ({
  createPage: vi.fn(),
  updatePage: vi.fn(), // <--- Resolves to undefined!
  getPage: vi.fn(),
  getPageBySlug: vi.fn().mockResolvedValue(null),
}));
```
Because `updatePage` resolves to `undefined`, `page = await updatePage(...)` assigns `page = undefined`. Accessing `page.id` on line 463 crashes with:
```
TypeError: Cannot read properties of undefined (reading 'id')
```
This fails **19 test cases** in `website.driver.test.js`.

#### Exact Solution
In `backend/src/modules/template-engine/drivers/website.driver.test.js`, mock `updatePage` so it returns an object containing the passed `id` and patch:

```diff
--- a/backend/src/modules/template-engine/drivers/website.driver.test.js
+++ b/backend/src/modules/template-engine/drivers/website.driver.test.js
@@ -38,7 +38,7 @@ vi.mock('../../media/service.js', () => ({
 
 vi.mock('../../page-builder/service.js', () => ({
   createPage:    vi.fn(),
-  updatePage:    vi.fn(),
+  updatePage:    vi.fn().mockImplementation((id, patch) => Promise.resolve({ id, ...patch })),
   getPage:       vi.fn(),
   getPageBySlug: vi.fn().mockResolvedValue(null),
 }));
@@ -102,4 +102,5 @@ function makeStageRecord(outputRef = null) {
 beforeEach(() => {
   vi.clearAllMocks();
+  updatePage.mockImplementation((id, patch) => Promise.resolve({ id, ...patch }));
 });
```
Also update test cases that expect `updatePage` calls:
- Lines ~467: newly created `'about'` page is auto-published, so expect `updatePage` to be called 1 time for `'page-about'`.
- Lines ~565: reused `'home'` is updated, plus newly created `'blog'` is auto-published, so expect 2 calls.
- Lines ~631, ~682, ~716: pass `project_id: 'proj-A'` in `getPage.mockResolvedValueOnce` so `patch.project_id` isn't triggered unnecessarily.

---

### Issue 2: Backend Catalog Seed-Content Test Unmocked DB (1 Failure)

* **Severity:** P0 CRITICAL (Crashes isolated backend test execution)
* **File:** `backend/src/modules/catalog/seed-content.test.js`
* **Trigger:** Top-level import of `service.js` invokes `database.js`.

#### Problem
In `backend/src/modules/catalog/seed-content.test.js`:
```javascript
import { resolveCatalogBindings } from './service.js';
```
`service.js` imports `src/config/database.js`. At import time, `database.js` executes:
```javascript
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}
```
Because `seed-content.test.js` only tests `resolveCatalogBindings` (a pure in-memory JSON transform), it never communicates with Postgres. However, running vitest without `DATABASE_URL` crashes before tests start.

#### Exact Solution
Add a lightweight mock of `database.js` at the top of `backend/src/modules/catalog/seed-content.test.js`:

```diff
--- a/backend/src/modules/catalog/seed-content.test.js
+++ b/backend/src/modules/catalog/seed-content.test.js
@@ -1,4 +1,8 @@
-import { describe, it, expect } from 'vitest';
+import { describe, it, expect, vi } from 'vitest';
+
+vi.mock('../../config/database.js', () => ({
+  prisma: {},
+}));
 import { readFileSync } from 'node:fs';
 import { fileURLToPath } from 'node:url';
 import path from 'node:path';
```

---

### Issue 3: Frontend Website Stage RTL Test Stale String Match (1 Failure)

* **Severity:** P0 CRITICAL (Fails frontend test runner)
* **File:** `frontend/tests/rtl/regression/template-engine-website-stage.test.tsx`
* **Line:** ~234

#### Problem
The test asserts:
```typescript
expect(screen.getByText('2 pages assembled')).toBeInTheDocument();
```
When sector detail pages were recently integrated, the header text in `WebsiteStage.tsx` was expanded:
```typescript
: `${pageCount} page${pageCount !== 1 ? 's' : ''} assembled in the page-builder engine. Open a page to edit it, or view all pages to step through the whole site.`
```
React Testing Library's `screen.getByText('string')` tests for an **exact full match** by default. Because the DOM contains a longer string, the exact match fails.

#### Exact Solution
Change the matcher from an exact string to a case-insensitive regex:

```diff
--- a/frontend/tests/rtl/regression/template-engine-website-stage.test.tsx
+++ b/frontend/tests/rtl/regression/template-engine-website-stage.test.tsx
@@ -231,6 +231,6 @@ describe('WebsiteStage — assemble view (post-typography)', () => {
     renderWithQC(<WebsiteStage run={makeRun({ home: 'page-1', about: 'page-2' })} />)
 
     fireEvent.click(screen.getByText('Web app'))
-    expect(screen.getByText('2 pages assembled')).toBeInTheDocument()
+    expect(screen.getByText(/2 pages assembled/i)).toBeInTheDocument()
   })
 })
```

---

### Issue 4: Frontend Construction Pack Unregistered Variants (3 Failures)

* **Severity:** P0 CRITICAL (Fails frontend test runner)
* **File:** `frontend/src/app/admin/page-builder/packs/construction/index.tsx`
* **Tested by:** `frontend/tests/regression/block-variants-gallery.test.ts`

#### Problem
Three components in `packs/construction/index.tsx` were recently upgraded with multi-design `variant?: '1' | '2'` fields:
1. `ConstructionIconFeatureGrid`
2. `ConstructionApproachSplit`
3. `ConstructionProcessSteps`

The regression test checks that every component with a `variant` select field is registered in `construction.variants`. Because these three were omitted from lines 16309–16317, the test fails:
```
AssertionError: ConstructionIconFeatureGrid has a multi-design variant field but no blockVariants entry: expected undefined to be defined
AssertionError: ConstructionApproachSplit has a multi-design variant field but no blockVariants entry: expected undefined to be defined
AssertionError: ConstructionProcessSteps has a multi-design variant field but no blockVariants entry: expected undefined to be defined
```

#### Exact Solution
Register all 3 components in the `variants` object at the bottom of `frontend/src/app/admin/page-builder/packs/construction/index.tsx`:

```diff
--- a/frontend/src/app/admin/page-builder/packs/construction/index.tsx
+++ b/frontend/src/app/admin/page-builder/packs/construction/index.tsx
@@ -16315,6 +16315,9 @@ export const construction: ComponentConfigPack = {
     ConstructionFooter: ['1', '2', '3', '4'],
     ConstructionSectorDetailList: ['1', '2', '3', '4'],
     ConstructionMissionVision: ['1', '2', '3', '4'],
+    ConstructionIconFeatureGrid: ['1', '2'],
+    ConstructionApproachSplit: ['1', '2'],
+    ConstructionProcessSteps: ['1', '2'],
   },
 }
```

---

## TIER 2: HIGH / P1 ISSUES (High Priority — Data Loss & Broken User Navigation)

---

### Issue 5: Zero Auto-Save in Puck Visual Page Builder (Work Loss on Refresh)

* **Severity:** P1 HIGH (Data Loss risk during page authoring)
* **File:** `frontend/src/app/admin/template-engine/edit/[id]/page.tsx`
* **Impact:** Any unsaved edits made to a page are wiped if the user refreshes or closes the browser tab.

#### Problem
Currently, edits in the Puck editor are only persisted to Postgres when the user explicitly clicks the "Save" button (`PUT /api/page-builder/:id`).
If a user spends 30 minutes composing sections or reordering blocks and their browser crashes or reloads, all progress is permanently lost.

#### Exact Solution
Implement a 1500ms debounced autosave hook with a visual status indicator and a `beforeunload` safeguard:

```tsx
// Inside frontend/src/app/admin/template-engine/edit/[id]/page.tsx:
const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

const handlePuckChange = useCallback((newData: Data) => {
  setSaveStatus('saving');
  if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

  autoSaveTimerRef.current = setTimeout(async () => {
    try {
      await api.put(`/api/page-builder/${pageId}`, { data: newData });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, 1500); // 1.5 second debounce
}, [pageId]);

// Window unload guard
useEffect(() => {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (saveStatus === 'saving') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
}, [saveStatus]);

// Header Status Badge:
<div className="flex items-center gap-2 text-xs">
  {saveStatus === 'saving' && <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Saving...</span>}
  {saveStatus === 'saved' && <span className="text-emerald-500 font-medium">✓ Saved</span>}
  {saveStatus === 'error' && <span className="text-destructive font-medium">⚠ Save failed</span>}
</div>
```

---

### Issue 6: Mobile Navigation Drawer Lacks 3-Level Menu Hierarchy

* **Severity:** P1 HIGH (Mobile UX defect)
* **File:** `frontend/src/app/admin/page-builder/packs/header-nav-menu.tsx`
* **Impact:** Mobile visitors on phones or tablets cannot access sub-menus or nested navigation links.

#### Problem
The `menus` module supports 3 levels of navigation (`Menu` and `MenuItem` with `parent_id`), but only `ConstructionHeader` Design 1 desktop nav consumes the tree.
The mobile drawer still iterates over flat strings from `props.links`:
```tsx
{links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
```
Sub-items (e.g. Products → HVAC → VRF Systems) are completely inaccessible to mobile users.

#### Exact Solution
Add a `MobileNavMenu` accordion component to `packs/header-nav-menu.tsx` and render it in the mobile drawer:

```tsx
export function MobileNavMenu({ tree }: { tree: MenuItemNode[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col space-y-1 py-2">
      {tree.map(item => {
        const hasChildren = item.children && item.children.length > 0;
        const isOpen = !!expanded[item.id];
        return (
          <div key={item.id} className="border-b border-border/30 pb-1.5">
            <div className="flex items-center justify-between">
              <a href={item.url} className="text-sm font-medium hover:text-primary">
                {item.label}
              </a>
              {hasChildren && (
                <button type="button" onClick={() => toggle(item.id)} className="p-1">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {hasChildren && isOpen && (
              <div className="ml-3 mt-1 flex flex-col space-y-1 border-l-2 border-primary/40 pl-2">
                {item.children.map(child => (
                  <a key={child.id} href={child.url} className="text-xs text-muted-foreground hover:text-primary">
                    {child.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

### Issue 7: ConstructionHeader Designs 2, 3, 4 Fall Back to Static Links

* **Severity:** P1 HIGH (Navigation inconsistency)
* **File:** `frontend/src/app/admin/page-builder/packs/construction/index.tsx`
* **Impact:** Changing header design in Layout step reverts the website navigation back to stale static links.

#### Problem
In `packs/construction/index.tsx`, only Design 1 uses `useHeaderMenuTree(props.projectId)`.
Designs 2 (centered logo), 3 (split navigation), and 4 (minimal bar) still read `props.links.split('\n')`.

#### Exact Solution
In `packs/construction/index.tsx`, replace the flat string mapping in Designs 2, 3, and 4 with `<HeaderNavMenu tree={menuTree} fallbackLinks={props.links} />` while preserving their visual styles (centered, split, minimal).

---

## TIER 3: MEDIUM / P2 ISSUES (Medium Priority — Architecture & Search Visibility)

---

### Issue 8: Missing Server-Side `generateMetadata` on Dynamic Sector Pages

* **Severity:** P2 MEDIUM (SEO & Social Sharing defect)
* **File:** `frontend/src/app/sectors/[slug]/page.tsx`
* **Impact:** Search engine bots (Google, Bing) and link unfurlers (WhatsApp, LinkedIn, X) cannot scrape metadata.

#### Problem
Dynamic sector routes (`/sectors/[slug]`) set `<title>` and `<meta>` tags inside a client-side React `useEffect`. Web crawlers that do not run JavaScript index the page with blank or default fallback titles.

#### Exact Solution
Export Next.js App Router async `generateMetadata` from `frontend/src/app/sectors/[slug]/page.tsx`:

```typescript
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const res = await fetch(
    `${process.env.INTERNAL_API_URL || 'http://backend:4000'}/api/sectors/public?slug=${params.slug}`
  );
  const data = await res.json();
  const sector = data?.data?.sector;

  if (!sector) {
    return { title: 'Sector Not Found | Subhadra Group' };
  }

  return {
    title: `${sector.seo_title || sector.name} | Subhadra Group`,
    description: sector.seo_description || sector.description,
    openGraph: {
      title: sector.seo_title || sector.name,
      description: sector.seo_description || sector.description,
      images: sector.og_image ? [{ url: sector.og_image }] : [{ url: sector.image }],
    },
  };
}
```

---

### Issue 9: Global `setting-fields` Lacks `project_id` Multi-Tenancy Scoping

* **Severity:** P2 MEDIUM (Data isolation gap)
* **File:** `backend/prisma/schema/core.prisma`
* **Impact:** Vision, Mission, and tagline fields are shared globally across all projects on the instance.

#### Problem
`SettingValue` only has a `field_id` foreign key. There is no `project_id` column:
```prisma
model SettingValue {
  id       String @id @default(cuid())
  field_id String @unique
  value    String
}
```
If a second project is added to the KDL Kit, changing its tagline overwrites the tagline of the first project.

#### Exact Solution
1. Add `project_id` to model `SettingValue` in `backend/prisma/schema/core.prisma`:
```prisma
model SettingValue {
  id         String   @id @default(cuid())
  field_id   String
  project_id String?
  value      String
  field      SettingField @relation(fields: [field_id], references: [id], onDelete: Cascade)
  project    Project?     @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@unique([field_id, project_id])
}
```
2. Run Prisma migration:
```bash
cd backend && npx prisma migrate dev --name add_project_id_to_setting_values
```
3. Update `setting-fields` service and route to filter by `projectId`.

---

## TIER 4: LOW / P3 ISSUES (Low Priority — Dependencies & Staging Cloud Setup)

---

### Issue 10: Dependabot Lockfile Backlog & Version Conflicts (14 Open PRs)

* **Severity:** P3 LOW (Maintenance debt)
* **Impact:** 14 automated security bump PRs are open on GitHub with failing lockfile checks.

#### Problem
Automated Dependabot bumps (#285 to #304) for packages like `sharp`, `multer`, `adm-zip`, and `next` failed CI due to merge conflicts in `package-lock.json` and `pnpm-lock.yaml`.

#### Exact Solution
Run lockfile reconciliation:
```bash
# In backend:
cd backend && npm audit fix && npm install --package-lock-only

# In frontend:
cd ../frontend && pnpm install --no-frozen-lockfile
```
Merge the clean patch PRs using `gh pr merge --squash` per project merge rules.

---

### Issue 11: Remote Staging VPS Deployment Pending Cloud Provisioning

* **Severity:** P3 LOW (Infrastructure setup)
* **File:** `MANUAL_TASKS.md` (§KDL-403)
* **Impact:** Remote URL `https://staging.kdl.f9tech.com` is not accessible on the public internet.

#### Problem
Automated CD staging requires a remote Ubuntu 22.04 VPS IP and secret. This requires human cloud account credentials that AI agents cannot execute autonomously.

#### Exact Solution (Follow `MANUAL_TASKS.md`)
1. Human provisions a $6/month VPS (DigitalOcean, Hetzner, or AWS EC2).
2. Run bootstrap script: `ssh ubuntu@<IP> 'bash -s' < infra/scripts/staging-bootstrap.sh`.
3. Set GitHub Environment Secrets: `STAGING_HOST` and `STAGING_ENV`.
4. Trigger `.github/workflows/cd-staging.yml` by pushing a commit to master.

---

## Step-by-Step High-to-Low Execution Roadmap

```bash
# ═════════════════════════════════════════════════════════════════
# STAGE 1: RESOLVE P0 CRITICAL BUILD BLOCKERS (30 mins)
# ═════════════════════════════════════════════════════════════════
# 1. Update website.driver.test.js mock (Issue 1)
# 2. Add database mock in seed-content.test.js (Issue 2)
# 3. Update regex in template-engine-website-stage.test.tsx (Issue 3)
# 4. Add 3 variants to construction/index.tsx (Issue 4)
# Verification:
cd backend && npm test      # 102/102 test files pass
cd ../frontend && pnpm test  # 40/40 test files pass

# ═════════════════════════════════════════════════════════════════
# STAGE 2: RESOLVE P1 HIGH DATA & USER FLOW ISSUES (1 day)
# ═════════════════════════════════════════════════════════════════
# 5. Add debounced autosave to Puck editor (Issue 5)
# 6. Wire 3-level menu tree to mobile drawer (Issue 6)
# 7. Wire 3-level menu tree to Header Designs 2-4 (Issue 7)

# ═════════════════════════════════════════════════════════════════
# STAGE 3: RESOLVE P2 MEDIUM ARCHITECTURE & SEO ISSUES (1 day)
# ═════════════════════════════════════════════════════════════════
# 8. Add generateMetadata to /sectors/[slug]/page.tsx (Issue 8)
# 9. Add project_id migration to SettingValue (Issue 9)

# ═════════════════════════════════════════════════════════════════
# STAGE 4: RESOLVE P3 LOW DEVOPS & STAGING (1 day)
# ═════════════════════════════════════════════════════════════════
# 10. Clean and merge Dependabot PRs (Issue 10)
# 11. Provision Staging VPS (Issue 11)
```

---
*Kalam Dream Labs — KDL Starter Kit Current Issues & Exact Solutions v2.0*
