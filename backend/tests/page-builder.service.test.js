import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    builderPage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    detailPageTemplate: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/shared/detail-pages/resolve.js', () => ({
  resolveForEditor: vi.fn(),
  stripEntityBindings: vi.fn(),
}));

vi.mock('../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

vi.mock('../src/modules/template-engine/site/queue.js', () => ({
  enqueueSiteBuild: vi.fn(),
}));

import { prisma } from '../src/config/database.js';
import { resolveForEditor, stripEntityBindings } from '../src/shared/detail-pages/resolve.js';
import { writeActivityAsync } from '../src/modules/user-management/shared/activity-logger.js';
import { enqueueSiteBuild } from '../src/modules/template-engine/site/queue.js';
import {
  listPages,
  getPage,
  getPageBySlug,
  getPublishedBySlug,
  createPage,
  updatePage,
  deletePage,
} from '../src/modules/page-builder/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('page-builder service — listPages', () => {
  it('returns all non-deleted pages ordered by updated_at desc', async () => {
    const rows = [
      { id: 'p1', slug: 'home', title: 'Home', status: 'PUBLISHED', updated_at: new Date(), project_id: 'proj1' },
    ];
    prismaMock.builderPage.findMany.mockResolvedValue(rows);

    const result = await listPages();

    expect(prismaMock.builderPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deleted_at: null } })
    );
    expect(result).toEqual(rows);
  });
});

describe('page-builder service — getPage', () => {
  it('returns null when page does not exist', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValue(null);
    expect(await getPage('missing-id')).toBeNull();
  });

  it('returns page directly when no template_id', async () => {
    const page = { id: 'p1', title: 'About', data: { root: {}, content: [] }, template_id: null };
    prismaMock.builderPage.findFirst.mockResolvedValue(page);

    const result = await getPage('p1');

    expect(result).toEqual(page);
    expect(resolveForEditor).not.toHaveBeenCalled();
  });

  it('merges template data into page when template_id is set', async () => {
    const page = { id: 'p1', title: 'Sector', data: null, template_id: 'tmpl1' };
    const template = { id: 'tmpl1', data: { root: {}, content: [{ type: 'Header' }] } };
    const resolved = { root: {}, content: [{ type: 'Header' }] };

    prismaMock.builderPage.findFirst.mockResolvedValue(page);
    prismaMock.detailPageTemplate.findUnique.mockResolvedValue(template);
    vi.mocked(resolveForEditor).mockResolvedValue(resolved);

    const result = await getPage('p1');

    expect(resolveForEditor).toHaveBeenCalledWith(page, template);
    expect(result).toEqual({ ...page, data: resolved });
  });

  it('returns bare page when template_id set but template row missing', async () => {
    const page = { id: 'p1', title: 'Orphan', data: null, template_id: 'tmpl-gone' };
    prismaMock.builderPage.findFirst.mockResolvedValue(page);
    prismaMock.detailPageTemplate.findUnique.mockResolvedValue(null);

    const result = await getPage('p1');

    expect(result).toEqual(page);
  });
});

describe('page-builder service — getPageBySlug', () => {
  it('finds including soft-deleted rows', async () => {
    const page = { id: 'p1', slug: 'old-page', deleted_at: new Date() };
    prismaMock.builderPage.findFirst.mockResolvedValue(page);

    const result = await getPageBySlug('old-page');

    // No deleted_at filter in the query — reserved slug is always found
    expect(prismaMock.builderPage.findFirst).toHaveBeenCalledWith({ where: { slug: 'old-page' } });
    expect(result).toEqual(page);
  });

  it('returns null when slug not found', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValue(null);
    expect(await getPageBySlug('ghost')).toBeNull();
  });
});

describe('page-builder service — getPublishedBySlug', () => {
  it('only returns PUBLISHED pages', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValue(null);

    await getPublishedBySlug('draft-page');

    expect(prismaMock.builderPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED', deleted_at: null }) })
    );
  });

  it('returns the published page when found', async () => {
    const page = { slug: 'home', title: 'Home', data: {}, project_id: 'proj1' };
    prismaMock.builderPage.findFirst.mockResolvedValue(page);

    expect(await getPublishedBySlug('home')).toEqual(page);
  });
});

describe('page-builder service — createPage', () => {
  it('creates page with default puck data when none supplied', async () => {
    const created = { id: 'p1', title: 'New', slug: 'new', status: 'DRAFT', project_id: 'proj1', data: {} };
    prismaMock.builderPage.create.mockResolvedValue(created);

    const result = await createPage({ title: 'New', slug: 'new', project_id: 'proj1' }, 'actor1');

    expect(prismaMock.builderPage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'New',
          slug: 'new',
          status: 'DRAFT',
          data: expect.objectContaining({ root: expect.any(Object), content: [], zones: {} }),
        }),
      })
    );
    expect(result).toEqual(created);
  });

  it('uses supplied puck data when provided', async () => {
    const customData = { root: { props: { title: 'X' } }, content: [{ type: 'Hero' }], zones: {} };
    const created = { id: 'p2', title: 'X', slug: 'x', status: 'DRAFT', project_id: 'proj1', data: customData };
    prismaMock.builderPage.create.mockResolvedValue(created);

    await createPage({ title: 'X', slug: 'x', data: customData, project_id: 'proj1' }, 'actor1');

    expect(prismaMock.builderPage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ data: customData }) })
    );
  });

  it('logs activity and enqueues a site build after creation', async () => {
    const created = { id: 'p1', title: 'Home', slug: 'home', status: 'DRAFT', project_id: 'proj1', data: {} };
    prismaMock.builderPage.create.mockResolvedValue(created);

    await createPage({ title: 'Home', slug: 'home', project_id: 'proj1' }, 'actor1');

    expect(writeActivityAsync).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'page-builder', action: 'created' })
    );
    expect(enqueueSiteBuild).toHaveBeenCalledWith('proj1');
  });
});

describe('page-builder service — updatePage', () => {
  it('updates a normal page directly', async () => {
    const updated = { id: 'p1', title: 'Updated', status: 'PUBLISHED', project_id: 'proj1' };
    prismaMock.builderPage.findFirst.mockResolvedValue({ id: 'p1', template_id: null, project_id: 'proj1' });
    prismaMock.builderPage.update.mockResolvedValue(updated);

    const result = await updatePage('p1', { title: 'Updated', status: 'PUBLISHED' }, 'actor1');

    expect(prismaMock.builderPage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' } })
    );
    expect(result).toEqual(updated);
    expect(enqueueSiteBuild).toHaveBeenCalled();
  });

  it('writes data through to the shared template for template-bound pages', async () => {
    const existing = { id: 'p1', template_id: 'tmpl1', project_id: 'proj1' };
    const template = { id: 'tmpl1', data: { root: {}, content: [] } };
    const stripped = { root: {}, content: [{ type: 'Banner' }] };
    const newData = { root: {}, content: [{ type: 'Banner' }], zones: {} };
    const updatedPage = { id: 'p1', template_id: 'tmpl1', project_id: 'proj1' };

    prismaMock.builderPage.findFirst.mockResolvedValue(existing);
    prismaMock.detailPageTemplate.findUnique.mockResolvedValue(template);
    vi.mocked(stripEntityBindings).mockResolvedValue(stripped);
    prismaMock.detailPageTemplate.update.mockResolvedValue({ id: 'tmpl1', data: stripped });
    prismaMock.builderPage.update.mockResolvedValue(updatedPage);

    const result = await updatePage('p1', { data: newData, status: 'PUBLISHED' }, 'actor1');

    expect(prismaMock.detailPageTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tmpl1' }, data: { data: stripped } })
    );
    expect(result).toMatchObject({ id: 'p1', data: stripped });
  });
});

describe('page-builder service — deletePage', () => {
  it('soft-deletes the page by setting deleted_at', async () => {
    const deleted = { id: 'p1', title: 'Gone', project_id: 'proj1', deleted_at: new Date() };
    prismaMock.builderPage.update.mockResolvedValue(deleted);

    const result = await deletePage('p1', 'actor1');

    expect(prismaMock.builderPage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ deleted_at: expect.any(Date) }) })
    );
    expect(result).toEqual(deleted);
    expect(writeActivityAsync).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deleted', subject_id: 'p1' })
    );
    expect(enqueueSiteBuild).toHaveBeenCalledWith('proj1');
  });
});
