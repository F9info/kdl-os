/**
 * T04: a page slug is unique per project, so two projects can each have a "home" page.
 * Page lists are per project, and the legacy /p/<slug> address stays deterministic when slugs repeat.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const db = vi.hoisted(() => ({
  prisma: {
    builderPage: { findMany: vi.fn(), findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
  },
}));
vi.mock('../../config/database.js', () => db);
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));

const { listPages, getPageBySlug, getPublishedBySlug } = await import('./service.js');

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.project.findFirst.mockResolvedValue({ id: 'default-id' });
});

describe('listPages', () => {
  it('lists only the pages of the project asked for', async () => {
    db.prisma.builderPage.findMany.mockResolvedValue([]);
    await listPages('proj-2');
    expect(db.prisma.builderPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deleted_at: null, project_id: 'proj-2' } })
    );
  });
});

describe('getPageBySlug', () => {
  it('looks inside one project when given one (the same slug may exist in another)', async () => {
    await getPageBySlug('home', 'proj-2');
    expect(db.prisma.builderPage.findFirst).toHaveBeenCalledWith({ where: { slug: 'home', project_id: 'proj-2' } });
  });
});

describe('getPublishedBySlug (legacy /p/<slug>)', () => {
  const page = (project_id) => ({ slug: 'home', title: project_id, project_id });

  it('returns null when nothing is published under the slug', async () => {
    db.prisma.builderPage.findMany.mockResolvedValue([]);
    expect(await getPublishedBySlug('home')).toBeNull();
  });

  it('returns the only match without asking for the default project', async () => {
    db.prisma.builderPage.findMany.mockResolvedValue([page('a')]);
    expect((await getPublishedBySlug('home')).project_id).toBe('a');
    expect(db.prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('prefers the default project when several projects share the slug', async () => {
    db.prisma.builderPage.findMany.mockResolvedValue([page('other'), page('default-id')]);
    expect((await getPublishedBySlug('home')).project_id).toBe('default-id');
  });

  it('falls back to the oldest page when the default project has none', async () => {
    db.prisma.builderPage.findMany.mockResolvedValue([page('first'), page('second')]);
    expect((await getPublishedBySlug('home')).project_id).toBe('first');
  });
});

describe('schema', () => {
  const schema = readFileSync(new URL('../../../prisma/schema/page-builder.prisma', import.meta.url), 'utf8');

  it('makes the slug unique per project, not globally, and requires a project', () => {
    expect(schema).toMatch(/@@unique\(\[project_id, slug\]\)/);
    expect(schema).toMatch(/^\s*slug\s+String\s*$/m); // no @unique on the column
    expect(schema).toMatch(/^\s*project_id\s+String\s*$/m); // not optional
  });
});
