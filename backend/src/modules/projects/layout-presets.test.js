import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  prisma: {
    layoutPreset: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    builderPage: { count: vi.fn(), updateMany: vi.fn() },
    project: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  getSiteLayout: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('./layout.js', () => ({ getSiteLayout: h.getSiteLayout }));

const svc = await import('./layout-presets.js');
const p = h.prisma;

const preset = (o = {}) => ({
  id: 'l1', project_id: 'p1', kind: 'HEADER', name: 'Main', status: 'PUBLISHED', is_default: false,
  variant: '3', config: { a: 'b' }, version: 1, deleted_at: null, ...o,
});

beforeEach(() => {
  vi.resetAllMocks();
  p.$transaction.mockImplementation(async (arg) => (typeof arg === 'function' ? arg(p) : Promise.all(arg)));
  p.builderPage.count.mockResolvedValue(0);
});

describe('resolveLayoutForPage: which header/footer a page shows', () => {
  const legacy = { header: { enabled: true, variant: '5' }, footer: { enabled: true, variant: '5' } };
  it('uses the layout assigned to the page, then the default, then the project selection', async () => {
    h.getSiteLayout.mockResolvedValue(legacy);
    p.layoutPreset.findMany
      .mockResolvedValueOnce([preset({ id: 'mine', variant: 'f9', config: { x: '1' } })])
      .mockResolvedValueOnce([preset({ id: 'def', kind: 'FOOTER', is_default: true, variant: '2' })]);
    const out = await svc.resolveLayoutForPage({ project_id: 'p1', header_layout_id: 'mine', footer_layout_id: null });
    expect(out.header).toEqual({ enabled: true, variant: 'f9', config: { x: '1' } });
    expect(out.footer).toEqual({ enabled: true, variant: '2', config: { a: 'b' } });
  });

  it('falls back to the project selection when no layout is assigned and none is default', async () => {
    h.getSiteLayout.mockResolvedValue(legacy);
    p.layoutPreset.findMany.mockResolvedValue([]);
    expect(await svc.resolveLayoutForPage({ project_id: 'p1' })).toEqual(legacy);
  });

  it('returns null when nothing is chosen anywhere', async () => {
    h.getSiteLayout.mockResolvedValue(null);
    p.layoutPreset.findMany.mockResolvedValue([]);
    expect(await svc.resolveLayoutForPage({ project_id: 'p1' })).toBeNull();
  });

  it('only looks at published, not deleted layouts of the page\'s own project', async () => {
    h.getSiteLayout.mockResolvedValue(null);
    p.layoutPreset.findMany.mockResolvedValue([]);
    await svc.resolveLayoutForPage({ project_id: 'p1', header_layout_id: 'mine' });
    for (const [arg] of p.layoutPreset.findMany.mock.calls) {
      expect(arg.where).toMatchObject({ project_id: 'p1', status: 'PUBLISHED', deleted_at: null });
    }
  });

  it('a page without a project has no layout', async () => {
    expect(await svc.resolveLayoutForPage({ project_id: null })).toBeNull();
  });
});

describe('layout rules', () => {
  it('a new layout is a draft unless said otherwise and is never the default', async () => {
    p.project.findFirst.mockResolvedValue({ id: 'p1' });
    p.layoutPreset.create.mockResolvedValue(preset());
    await svc.createLayout('p1', { kind: 'HEADER', name: 'X', variant: '1' }, 'u1');
    const data = p.layoutPreset.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'DRAFT', config: {}, created_by: 'u1' });
    expect(data.is_default).toBeUndefined();
  });

  it('duplicating makes a draft, non-default copy', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(preset({ is_default: true }));
    p.layoutPreset.create.mockResolvedValue(preset());
    await svc.duplicateLayout('p1', 'l1');
    expect(p.layoutPreset.create.mock.calls[0][0].data).toMatchObject({ name: 'Main (copy)', status: 'DRAFT', variant: '3', config: { a: 'b' } });
  });

  it('only a published layout can become the default, and the previous default is cleared', async () => {
    p.layoutPreset.findFirst.mockResolvedValueOnce(preset({ status: 'DRAFT' }));
    await expect(svc.setDefaultLayout('p1', 'l1')).rejects.toMatchObject({ status: 409 });
    p.layoutPreset.findFirst.mockResolvedValueOnce(preset());
    p.layoutPreset.update.mockResolvedValue(preset({ is_default: true }));
    await svc.setDefaultLayout('p1', 'l1');
    expect(p.layoutPreset.updateMany).toHaveBeenCalledWith({
      where: { project_id: 'p1', kind: 'HEADER', is_default: true, NOT: { id: 'l1' } },
      data: { is_default: false },
    });
  });

  it('the default cannot be unpublished or deleted', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(preset({ is_default: true }));
    await expect(svc.updateLayout('p1', 'l1', { status: 'DRAFT' })).rejects.toMatchObject({ status: 409 });
    await expect(svc.deleteLayout('p1', 'l1')).rejects.toMatchObject({ status: 409 });
  });

  it('deleting a layout pages use needs force, then clears those pages', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(preset());
    p.builderPage.count.mockResolvedValue(2);
    await expect(svc.deleteLayout('p1', 'l1')).rejects.toMatchObject({ status: 409, pages: 2 });
    await svc.deleteLayout('p1', 'l1', { force: true });
    expect(p.builderPage.updateMany).toHaveBeenCalledWith({ where: { header_layout_id: 'l1' }, data: { header_layout_id: null } });
    expect(p.builderPage.updateMany).toHaveBeenCalledWith({ where: { footer_layout_id: 'l1' }, data: { footer_layout_id: null } });
    expect(p.layoutPreset.update.mock.calls[0][0].data.deleted_at).toBeInstanceOf(Date);
  });

  it('the version goes up only when the design changes, not for a rename', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(preset());
    p.layoutPreset.update.mockResolvedValue(preset());
    await svc.updateLayout('p1', 'l1', { name: 'Renamed' });
    expect(p.layoutPreset.update.mock.calls[0][0].data.version).toBeUndefined();
    await svc.updateLayout('p1', 'l1', { variant: '4' });
    expect(p.layoutPreset.update.mock.calls[1][0].data.version).toEqual({ increment: 1 });
  });

  it('a layout of another project or the wrong kind cannot be assigned', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(null);
    await expect(svc.assertAssignable('p1', 'x', 'FOOTER')).rejects.toMatchObject({ status: 422 });
    await expect(svc.assertAssignable('p1', null, 'FOOTER')).resolves.toBeUndefined();
  });

  it('a project that had a layout before the library gets it as the published default', async () => {
    p.layoutPreset.count.mockResolvedValue(0);
    h.getSiteLayout.mockResolvedValue({ header: { enabled: true, variant: 'f9', config: { k: 'v' } }, footer: { enabled: false, variant: '1' } });
    p.layoutPreset.findMany.mockResolvedValue([]);
    await svc.listLayouts('p1');
    expect(p.layoutPreset.create).toHaveBeenCalledTimes(1);
    expect(p.layoutPreset.create.mock.calls[0][0].data).toMatchObject({ kind: 'HEADER', status: 'PUBLISHED', is_default: true, variant: 'f9', config: { k: 'v' } });
  });
});

describe('Layout page and library stay in step', () => {
  it('a slot switched off on the Layout page stays off for every page, even with layouts assigned', async () => {
    h.getSiteLayout.mockResolvedValue({ footer: { enabled: false, variant: '5' } });
    p.layoutPreset.findMany
      .mockResolvedValueOnce([preset({ id: 'mine', kind: 'FOOTER' })])
      .mockResolvedValueOnce([preset({ id: 'def', kind: 'FOOTER', is_default: true })]);
    const out = await svc.resolveLayoutForPage({ project_id: 'p1', footer_layout_id: 'mine' });
    expect(out.footer).toEqual({ enabled: false, variant: '5' });
  });

  it('saving a design on the Layout page changes the default layout of that kind', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(preset({ is_default: true, variant: '5', config: {} }));
    await svc.syncDefaultsFromSelection('p1', { header: { enabled: true, variant: 'f9', config: { ctaLast: 'true' } } });
    expect(p.layoutPreset.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { variant: 'f9', config: { ctaLast: 'true' }, version: { increment: 1 } },
    });
  });

  it('creates a published default when the kind has none, and leaves a switched-off slot alone', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(null);
    await svc.syncDefaultsFromSelection('p1', {
      header: { enabled: true, variant: '2' },
      footer: { enabled: false, variant: '1' },
    });
    expect(p.layoutPreset.create).toHaveBeenCalledTimes(1);
    expect(p.layoutPreset.create.mock.calls[0][0].data).toMatchObject({ kind: 'HEADER', status: 'PUBLISHED', is_default: true, variant: '2' });
  });

  it('does not touch the default when the design is unchanged', async () => {
    p.layoutPreset.findFirst.mockResolvedValue(preset({ is_default: true, variant: '3', config: { a: 'b' } }));
    await svc.syncDefaultsFromSelection('p1', { header: { enabled: true, variant: '3', config: { a: 'b' } } });
    expect(p.layoutPreset.update).not.toHaveBeenCalled();
  });
});
