import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const tx = {
    pageVersion: { findFirst: vi.fn(), create: vi.fn() },
    builderPage: { update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      builderPage: { findFirst: vi.fn(), update: vi.fn() },
      pageVersion: { findFirst: vi.fn(), findMany: vi.fn() },
      detailPageTemplate: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(async (fn) => fn(tx)),
    },
    revalidate: vi.fn(),
    build: vi.fn(),
    activity: vi.fn(),
    validate: vi.fn(),
  };
});
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('./validate.js', () => ({ validatePage: h.validate }));
vi.mock('../../shared/frontend-revalidate.js', () => ({ revalidatePublicPages: h.revalidate }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: h.build }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: h.activity }));
vi.mock('../../shared/detail-pages/resolve.js', () => ({
  resolveForEditor: vi.fn(async (_p, _t) => ({ content: [] })),
  stripEntityBindings: vi.fn(async (_p, _t, d) => d),
}));

const service = await import('./service.js');
const versions = await import('./versions.js');

const LIVE = {
  root: { props: {} },
  content: [{ type: 'Hero', props: { id: 'a', title: 'Live' } }],
  zones: {},
};
const DRAFT = {
  root: { props: {} },
  content: [{ type: 'Hero', props: { id: 'a', title: 'Draft' } }],
  zones: {},
};
const page = (over = {}) => ({
  id: 'p1',
  title: 'Home',
  status: 'PUBLISHED',
  data: LIVE,
  draft_data: null,
  seo: null,
  template_id: null,
  project_id: 'proj',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.validate.mockResolvedValue({ issues: [], errors: 0, warnings: 0, can_publish: true });
  h.prisma.builderPage.findFirst.mockResolvedValue(page());
  h.prisma.builderPage.update.mockImplementation(async ({ data }) => ({ ...page(), ...data }));
  h.tx.builderPage.update.mockImplementation(async ({ data }) => ({ ...page(), ...data }));
  h.tx.pageVersion.findFirst.mockResolvedValue({
    id: 'v1',
    version: 1,
    title: 'Home',
    data: LIVE,
    seo: null,
  });
  h.tx.pageVersion.create.mockImplementation(async ({ data }) => ({ id: `v${data.version}`, ...data }));
});

describe('editing a live page only changes its draft', () => {
  it('data on a PUBLISHED page goes to draft_data; live data and status are untouched', async () => {
    const r = await service.updatePage('p1', { data: DRAFT }, 'u');
    const written = h.prisma.builderPage.update.mock.calls[0][0].data;
    expect(written.draft_data.content[0].props.title).toBe('Draft');
    expect(written).not.toHaveProperty('data');
    expect(written).not.toHaveProperty('status');
    expect(r.data.content[0].props.title).toBe('Draft'); // caller still gets the working copy
    expect(h.tx.pageVersion.create).not.toHaveBeenCalled();
  });

  it('data on a DRAFT page is written straight to data (nothing is live)', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ status: 'DRAFT' }));
    await service.updatePage('p1', { data: DRAFT }, 'u');
    const written = h.prisma.builderPage.update.mock.calls[0][0].data;
    expect(written.data.content[0].props.title).toBe('Draft');
    expect(written).not.toHaveProperty('draft_data');
  });

  it('404 for a missing page', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(null);
    await expect(service.updatePage('x', { data: DRAFT }, 'u')).rejects.toMatchObject({ status: 404 });
  });
});

describe('publish', () => {
  it('snapshots the pending draft as the next version and makes it live', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ draft_data: DRAFT }));
    const r = await service.publish('p1', {}, 'u1');
    const v = h.tx.pageVersion.create.mock.calls[0][0].data;
    expect(v).toMatchObject({ page_id: 'p1', version: 2, title: 'Home', created_by: 'u1' });
    expect(v.data.content[0].props.title).toBe('Draft');
    const live = h.tx.builderPage.update.mock.calls[0][0].data;
    expect(live).toMatchObject({ status: 'PUBLISHED' });
    expect(live.data.content[0].props.title).toBe('Draft');
    expect(r).toMatchObject({ live_version: 2, version_changed: true });
    expect(r).not.toHaveProperty('draft_data');
    expect(h.revalidate).toHaveBeenCalledTimes(1);
    expect(h.build).toHaveBeenCalledWith('proj');
    expect(h.activity.mock.calls[0][0]).toMatchObject({ action: 'published' });
  });

  it('data, title and seo in the body are published with it', async () => {
    await service.publish('p1', { data: DRAFT, title: 'New', seo: { title: 'S' } }, 'u');
    expect(h.tx.pageVersion.create.mock.calls[0][0].data).toMatchObject({
      title: 'New',
      seo: { title: 'S' },
    });
    expect(h.tx.builderPage.update.mock.calls[0][0].data).toMatchObject({
      title: 'New',
      seo: { title: 'S' },
    });
  });

  it('first publish of a DRAFT page creates version 1', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ status: 'DRAFT' }));
    h.tx.pageVersion.findFirst.mockResolvedValue(null);
    const r = await service.publish('p1', {}, 'u');
    expect(h.tx.pageVersion.create.mock.calls[0][0].data.version).toBe(1);
    expect(r.live_version).toBe(1);
  });

  it('publishing what is already live changes nothing (no version, no revalidate)', async () => {
    const r = await service.publish('p1', {}, 'u');
    expect(h.tx.pageVersion.create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ live_version: 1, version_changed: false });
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it('a draft equal to the live content is just cleared, not versioned', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ draft_data: JSON.parse(JSON.stringify(LIVE)) }));
    await service.publish('p1', {}, 'u');
    expect(h.tx.pageVersion.create).not.toHaveBeenCalled();
    expect(h.tx.builderPage.update).toHaveBeenCalledTimes(1);
  });

  it('PUT with status PUBLISHED (older callers, e.g. the website driver) goes through the same path', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ status: 'DRAFT', data: DRAFT }));
    h.tx.pageVersion.findFirst.mockResolvedValue(null);
    await service.updatePage('p1', { status: 'PUBLISHED' }, 'u');
    expect(h.tx.pageVersion.create).toHaveBeenCalledTimes(1);
  });

  it('template-bound pages keep the old behaviour: no version row', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ template_id: 't1', status: 'DRAFT' }));
    h.prisma.detailPageTemplate.findUnique.mockResolvedValue({ id: 't1' });
    await service.updatePage('p1', { status: 'PUBLISHED', data: DRAFT }, 'u');
    expect(h.prisma.detailPageTemplate.update).toHaveBeenCalled();
    expect(h.tx.pageVersion.create).not.toHaveBeenCalled();
  });
});

describe('pages that were live before versions existed', () => {
  it('first publish keeps the current live content as v1, then adds the new version as v2', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ draft_data: DRAFT }));
    h.tx.pageVersion.findFirst.mockResolvedValue(null);
    const r = await service.publish('p1', {}, 'u');
    const [baseline, next] = h.tx.pageVersion.create.mock.calls.map((c) => c[0].data);
    expect(baseline).toMatchObject({ version: 1, note: 'Live content before versioning', created_by: null });
    expect(baseline.data.content[0].props.title).toBe('Live');
    expect(next.version).toBe(2);
    expect(next.data.content[0].props.title).toBe('Draft');
    expect(r.live_version).toBe(2);
  });

  it('publishing unchanged content only records the baseline, not a duplicate version', async () => {
    h.tx.pageVersion.findFirst.mockResolvedValue(null);
    // a real database hands back null for the seo column the sentinel stands for
    h.tx.pageVersion.create.mockImplementation(async ({ data }) => ({ id: 'v1', ...data, seo: null }));
    const r = await service.publish('p1', {}, 'u');
    expect(h.tx.pageVersion.create).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ live_version: 1, version_changed: false });
  });
});

describe('pre-publish checks (T6.4)', () => {
  const broken = {
    issues: [{ severity: 'error', code: 'LINK_BROKEN', message: 'A link points nowhere.' }],
    errors: 1,
    warnings: 0,
    can_publish: false,
  };

  it('errors block the publish with a 422 that carries the issues; nothing is written', async () => {
    h.validate.mockResolvedValue(broken);
    await expect(service.publish('p1', { data: DRAFT }, 'u')).rejects.toMatchObject({
      status: 422,
      errors: { code: 'PUBLISH_VALIDATION_FAILED', issues: broken.issues },
    });
    expect(h.tx.pageVersion.create).not.toHaveBeenCalled();
    expect(h.prisma.builderPage.update).not.toHaveBeenCalled();
  });

  it('force ("publish anyway") skips the checks and publishes', async () => {
    h.validate.mockResolvedValue(broken);
    const r = await service.publish('p1', { data: DRAFT, force: true }, 'u');
    expect(h.validate).not.toHaveBeenCalled();
    expect(r.live_version).toBe(2);
  });

  it('warnings alone never block', async () => {
    h.validate.mockResolvedValue({
      issues: [{ severity: 'warning' }],
      errors: 0,
      warnings: 1,
      can_publish: true,
    });
    await expect(service.publish('p1', {}, 'u')).resolves.toMatchObject({
      version_changed: expect.any(Boolean),
    });
  });

  it('checks what would go live: the body content, else the pending draft', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ draft_data: DRAFT }));
    await service.publish('p1', {}, 'u');
    expect(h.validate.mock.calls[0][0].data.content[0].props.title).toBe('Draft');
    await service.publish('p1', { data: LIVE, title: 'New', seo: { title: 'S' } }, 'u');
    expect(h.validate.mock.calls[1][0]).toMatchObject({ title: 'New', seo: { title: 'S' }, slug: undefined });
    expect(h.validate.mock.calls[1][0].data.content[0].props.title).toBe('Live');
  });

  it('system callers (PUT status PUBLISHED: website driver, imports) are not blocked', async () => {
    h.validate.mockResolvedValue(broken);
    await expect(service.updatePage('p1', { status: 'PUBLISHED' }, 'u')).resolves.toBeTruthy();
    expect(h.validate).not.toHaveBeenCalled();
  });

  it('template-bound pages are not checked', async () => {
    h.validate.mockResolvedValue(broken);
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ template_id: 't1', status: 'DRAFT' }));
    h.prisma.detailPageTemplate.findUnique.mockResolvedValue({ id: 't1' });
    await service.publish('p1', { data: DRAFT }, 'u');
    expect(h.validate).not.toHaveBeenCalled();
  });

  it('checkPage reports on the working copy; template pages and missing pages', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ draft_data: DRAFT }));
    h.validate.mockResolvedValue(broken);
    expect(await service.checkPage('p1')).toBe(broken);
    expect(h.validate.mock.calls[0][0].data.content[0].props.title).toBe('Draft');
    await service.checkPage('p1', { data: LIVE, title: 'Edited' }); // unsaved editor content wins
    expect(h.validate.mock.calls[1][0]).toMatchObject({ title: 'Edited' });
    expect(h.validate.mock.calls[1][0].data.content[0].props.title).toBe('Live');
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ template_id: 't1' }));
    expect(await service.checkPage('p1')).toMatchObject({ can_publish: true, issues: [] });
    h.prisma.builderPage.findFirst.mockResolvedValue(null);
    await expect(service.checkPage('x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('unpublish', () => {
  it('goes offline; the pending draft becomes the page content; versions are kept', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ draft_data: DRAFT }));
    await service.unpublish('p1', 'u');
    const written = h.prisma.builderPage.update.mock.calls[0][0].data;
    expect(written.status).toBe('DRAFT');
    expect(written.data.content[0].props.title).toBe('Draft');
    expect(h.revalidate).toHaveBeenCalledTimes(1);
    expect(h.activity.mock.calls[0][0]).toMatchObject({ action: 'unpublished' });
  });
});

describe('restore', () => {
  const old = { id: 'v1', version: 1, page_id: 'p1', title: 'Old title', data: DRAFT, seo: null };
  it('publishes an older version as a NEW version (history stays linear)', async () => {
    h.prisma.pageVersion.findFirst.mockResolvedValue(old);
    h.tx.pageVersion.findFirst.mockResolvedValue({
      id: 'v3',
      version: 3,
      title: 'Home',
      data: LIVE,
      seo: null,
    });
    const r = await service.restore('p1', 'v1', 'u');
    const created = h.tx.pageVersion.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ version: 4, title: 'Old title', note: 'Restored from v1' });
    expect(created.data.content[0].props.title).toBe('Draft');
    expect(r.live_version).toBe(4);
  });
  it('404 for a version of another page; 409 for template pages', async () => {
    h.prisma.pageVersion.findFirst.mockResolvedValue(null);
    await expect(service.restore('p1', 'zzz', 'u')).rejects.toMatchObject({ status: 404 });
    expect(h.prisma.pageVersion.findFirst.mock.calls[0][0].where).toEqual({ id: 'zzz', page_id: 'p1' });
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ template_id: 't1' }));
    await expect(service.restore('p1', 'v1', 'u')).rejects.toMatchObject({ status: 409 });
  });
});

describe('listVersions / withPublishState', () => {
  it('marks only the newest version live, and only while published', async () => {
    h.prisma.pageVersion.findMany.mockResolvedValue([{ version: 2 }, { version: 1 }]);
    expect((await versions.listVersions('p1')).map((v) => v.is_live)).toEqual([true, false]);
    h.prisma.builderPage.findFirst.mockResolvedValue(page({ status: 'DRAFT' }));
    expect((await versions.listVersions('p1')).map((v) => v.is_live)).toEqual([false, false]);
  });

  it('editor view: working copy as data, pending-change flag, live version, no raw draft_data', async () => {
    h.prisma.pageVersion.findFirst.mockResolvedValue({ version: 3 });
    const view = await versions.withPublishState(page({ draft_data: DRAFT }));
    expect(view.data.content[0].props.title).toBe('Draft');
    expect(view).toMatchObject({ has_unpublished_changes: true, live_version: 3 });
    expect(view).not.toHaveProperty('draft_data');
    const clean = await versions.withPublishState(page());
    expect(clean).toMatchObject({ has_unpublished_changes: false });
  });

  it('a draft identical to live is not "unpublished changes"; DRAFT pages have no live version', async () => {
    expect(versions.hasUnpublishedChanges(page({ draft_data: JSON.parse(JSON.stringify(LIVE)) }))).toBe(
      false
    );
    const view = await versions.withPublishState(page({ status: 'DRAFT' }));
    expect(view.live_version).toBeNull();
  });
});
