import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = {
  userRole: { findFirst: vi.fn(async () => ({ user_id: 'admin-1' })) },
  media: { findUnique: vi.fn(async () => ({ scan_result: 'CLEAN' })) },
  menu: { findFirst: vi.fn(async () => ({ id: 'menu-h' })) },
  menuItem: { count: vi.fn(async () => 0) },
  templateEngineStage: { upsert: vi.fn(async () => ({})) },
  builderPage: { findFirst: vi.fn(async () => null), findUnique: vi.fn(async ({ where }) => ({ id: where.id, slug: `te-r1-${where.id}`, title: where.id[0].toUpperCase() + where.id.slice(1) })) },
};
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../default-project.js', () => ({ getDefaultProjectId: vi.fn(async () => 'p1') }));

const { completeStudioDefaults, STUDIO_NAV_PAGES, STUDIO_TYPOGRAPHY, STUDIO_LAYOUT } = await import('./studio-defaults.js');

// A fake Studio: stages become DONE as they are advanced; the kit moves draft -> approved.
function fakeDeps({ existingRun = null, requireScan = false, kitStatus = 'inferred' } = {}) {
  const stages = new Map((existingRun?.stages ?? []).map((s) => [s.stage, s.status]));
  const kit = { status: kitStatus, logo_media_id: 'm1', contrast_report: { adjustments: [{ id: 'a1' }, { id: 'a2' }] } };
  const calls = [];
  const run = () => ({
    id: 'r1',
    stages: [...stages].map(([stage, status]) => ({
      stage,
      status,
      outputRef: stage === 'WEBSITE' ? { pageKeyToId: { home: 'home', about: 'about', services: 'services', contact: 'contact', 'service-detail': 'sd' }, pageKeyToTitle: { home: 'Home', about: 'About', services: 'Services', contact: 'Contact', 'service-detail': 'Service detail' } } : null,
    })),
  });
  return {
    calls,
    kit,
    deps: {
      listRuns: vi.fn(async () => (existingRun ? [run()] : [])),
      createRun: vi.fn(async () => { calls.push('createRun'); return run(); }),
      getRun: vi.fn(async () => run()),
      advanceStage: vi.fn(async (_id, slug, actor, projectId, options) => {
        calls.push(`advance:${slug}`);
        stages.set(slug.toUpperCase(), 'DONE');
        if (slug === 'website') calls.push(`nav:${options.navigationPages.join(',')}`);
        expect(actor).toBe('admin-1');
        expect(projectId).toBe('p1');
      }),
      getKit: vi.fn(async () => kit),
      patchKit: vi.fn(async (_p, o) => { calls.push('patchKit'); expect(o).toEqual({ typography: STUDIO_TYPOGRAPHY }); }),
      approveKit: vi.fn(async (_p, o) => { calls.push(`approveKit:${o.acknowledgedAdjustmentIds.join(',')}`); kit.status = 'approved'; }),
      getUploadSettings: vi.fn(async () => ({ requireScan })),
      getSiteLayout: vi.fn(async () => null),
      saveSiteLayout: vi.fn(async (_p, l) => { calls.push('layout'); expect(l).toEqual(STUDIO_LAYOUT); }),
      addPageToMenus: vi.fn(async (_c, { page }) => calls.push(`menu:${page.title}`)),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.menuItem.count.mockResolvedValue(0);
  prisma.media.findUnique.mockResolvedValue({ scan_result: 'CLEAN' });
  prisma.builderPage.findFirst.mockResolvedValue(null);
});

describe('completeStudioDefaults', () => {
  it('runs the Studio in the order the backend requires, with the screens\' defaults', async () => {
    const f = fakeDeps();
    const r = await completeStudioDefaults({ deps: f.deps });
    expect(r.status).toBe('done');
    expect(f.calls).toEqual([
      'createRun',
      'advance:intake',
      'advance:palette',
      'advance:inference',
      'patchKit', // after inference (it sets Inter/Inter), before approval (approved kits are read-only)
      'approveKit:a1,a2',
      'advance:approval',
      'layout',
      'advance:website',
      `nav:${STUDIO_NAV_PAGES.join(',')}`,
      'menu:Home',
      'menu:About',
      'menu:Services',
      'menu:Contact', // detail pages are not menu links
    ]);
  });

  it('does nothing when the website stage is already done', async () => {
    const f = fakeDeps({ existingRun: { stages: [{ stage: 'WEBSITE', status: 'DONE' }] } });
    expect(await completeStudioDefaults({ deps: f.deps })).toMatchObject({ status: 'already-done', runId: 'r1' });
    expect(f.calls).toEqual([]);
  });

  it('continues a half-finished run without repeating finished stages', async () => {
    const f = fakeDeps({
      existingRun: { stages: [{ stage: 'INTAKE', status: 'DONE' }, { stage: 'PALETTE', status: 'DONE' }] },
    });
    await completeStudioDefaults({ deps: f.deps });
    expect(f.calls[0]).toBe('advance:inference');
    expect(f.calls).not.toContain('createRun');
  });

  it('reuses the sample-content pages instead of creating a second Home, About, Services, Contact', async () => {
    prisma.builderPage.findFirst.mockImplementation(async ({ where }) =>
      ['home', 'contact'].includes(where.route_key) ? { id: `starter-${where.route_key}` } : null,
    );
    const f = fakeDeps();
    await completeStudioDefaults({ deps: f.deps });
    expect(prisma.templateEngineStage.upsert).toHaveBeenCalledWith({
      where: { runId_stage: { runId: 'r1', stage: 'WEBSITE' } },
      create: { runId: 'r1', stage: 'WEBSITE', status: 'PENDING', outputRef: { pageKeyToId: { home: 'starter-home', contact: 'starter-contact' } } },
      update: { outputRef: { pageKeyToId: { home: 'starter-home', contact: 'starter-contact' } } },
    });
    // only pages the Studio made itself (slug te-...) are looked past
    expect(prisma.builderPage.findFirst.mock.calls[0][0].where).toMatchObject({ project_id: 'p1', deleted_at: null, NOT: { slug: { startsWith: 'te-' } } });
  });

  it('does not touch the website stage record when there are no starter pages', async () => {
    const f = fakeDeps();
    await completeStudioDefaults({ deps: f.deps });
    expect(prisma.templateEngineStage.upsert).not.toHaveBeenCalled();
  });

  it('leaves menus alone when they already have links (the sample-content site)', async () => {
    prisma.menuItem.count.mockResolvedValue(5);
    const f = fakeDeps();
    await completeStudioDefaults({ deps: f.deps });
    expect(f.calls.some((c) => c.startsWith('menu:'))).toBe(false);
  });

  it('waits for the logo virus scan when production requires it', async () => {
    prisma.media.findUnique.mockResolvedValueOnce({ scan_result: null }).mockResolvedValueOnce({ scan_result: 'CLEAN' });
    const f = fakeDeps({ requireScan: true });
    expect((await completeStudioDefaults({ deps: f.deps, pollMs: 1 })).status).toBe('done');
    expect(prisma.media.findUnique).toHaveBeenCalledTimes(2);
  });

  it('stops with a clear code when no virus scanner runs but production requires a scan', async () => {
    prisma.media.findUnique.mockResolvedValue({ scan_result: 'SKIPPED' });
    const f = fakeDeps({ requireScan: true });
    await expect(completeStudioDefaults({ deps: f.deps, pollMs: 1 })).rejects.toMatchObject({ code: 'LOGO_SCAN_NOT_CLEAN' });
    expect(f.calls).toEqual(['createRun', 'advance:intake']);
  });

  it('stops at once with NO_LOGO when the brand kit has no logo, instead of waiting for a scan', async () => {
    const f = fakeDeps({ requireScan: true });
    f.kit.logo_media_id = null;
    await expect(completeStudioDefaults({ deps: f.deps, pollMs: 1 })).rejects.toMatchObject({ code: 'NO_LOGO' });
    expect(prisma.media.findUnique).not.toHaveBeenCalled();
  });

  it('skips when there is no Super Admin to act as', async () => {
    prisma.userRole.findFirst.mockResolvedValueOnce(null);
    const f = fakeDeps();
    expect(await completeStudioDefaults({ deps: f.deps })).toMatchObject({ status: 'skipped' });
  });
});
