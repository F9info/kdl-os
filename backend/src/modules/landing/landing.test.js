import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const prismaMock = vi.hoisted(() => {
  const tx = {
    site: { create: vi.fn() },
    builderPage: { create: vi.fn() },
    form: { create: vi.fn() },
  };
  return {
    project: { findFirst: vi.fn() },
    site: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn) => fn(tx)),
    tx,
  };
});
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));

const { listLandingSites, createLandingPage } = await import('./service.js');
const { listTemplates, buildLandingData, TEMPLATE_KEYS } = await import('./templates.js');
const { createLandingSchema } = await import('./schema.js');
const { manifestSchema } = await import('../../shared/modules/manifest-schema.js');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findFirst.mockResolvedValue({ id: 'p1' });
  prismaMock.tx.site.create.mockResolvedValue({ id: 's1', slug: 'spring', name: 'Spring' });
  prismaMock.tx.form.create.mockResolvedValue({ id: 'f1', name: 'Spring enquiry' });
  prismaMock.tx.builderPage.create.mockResolvedValue({
    id: 'pg1',
    slug: 'spring',
    title: 'Spring',
    status: 'DRAFT',
  });
});

describe('manifest', () => {
  it('is a valid manifest with no sidebar entry (reached from the Brands page)', () => {
    const raw = JSON.parse(readFileSync(new URL('./module.json', import.meta.url), 'utf8'));
    const parsed = manifestSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    expect(raw.nav).toEqual([]);
  });
});

describe('templates', () => {
  it('lists every template with a name', () => {
    expect(listTemplates().map((t) => t.key)).toEqual(TEMPLATE_KEYS);
    expect(listTemplates().every((t) => t.name && t.description)).toBe(true);
  });

  it('blank has no blocks; the others have a Hero first', () => {
    expect(buildLandingData('blank', 's', 'S').content).toEqual([]);
    for (const key of TEMPLATE_KEYS.filter((k) => k !== 'blank')) {
      expect(buildLandingData(key, 's', 'S').content[0].type).toBe('Hero');
    }
  });

  it('gives every block a unique id and sets the page title', () => {
    for (const key of TEMPLATE_KEYS) {
      const data = buildLandingData(key, 'spring', 'Spring Sale');
      const ids = data.content.map((b) => b.props.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(data.root.props.title).toBe('Spring Sale');
    }
  });
});

describe('createLandingSchema', () => {
  const parse = (body) => createLandingSchema.safeParse({ body });
  it('defaults the template to blank', () => {
    expect(parse({ name: 'A', slug: 'a' }).data.body.template).toBe('blank');
  });
  it('rejects a bad slug, an empty name and an unknown template', () => {
    expect(parse({ name: 'A', slug: 'Bad Slug' }).success).toBe(false);
    expect(parse({ name: ' ', slug: 'a' }).success).toBe(false);
    expect(parse({ name: 'A', slug: 'a', template: 'nope' }).success).toBe(false);
  });
});

describe('createLandingPage', () => {
  it('creates a LANDING site and its draft page in one transaction', async () => {
    const site = await createLandingPage({ name: 'Spring', slug: 'spring', template: 'lead-gen' }, 'u1');
    expect(prismaMock.tx.site.create.mock.calls[0][0].data).toMatchObject({
      project_id: 'p1',
      type: 'LANDING',
      slug: 'spring',
    });
    const page = prismaMock.tx.builderPage.create.mock.calls[0][0].data;
    expect(page).toMatchObject({
      slug: 'spring',
      status: 'DRAFT',
      site_id: 's1',
      project_id: 'p1',
      created_by: 'u1',
    });
    expect(page.data.content.length).toBeGreaterThan(0);
    expect(site.pages).toHaveLength(1);
  });

  it('lead-gen also creates its enquiry form; blank does not', async () => {
    await createLandingPage({ name: 'Spring', slug: 'spring', template: 'lead-gen' }, 'u1');
    expect(prismaMock.tx.form.create.mock.calls[0][0].data).toMatchObject({
      slug: 'spring-enquiry',
      project_id: 'p1',
    });
    const block = prismaMock.tx.builderPage.create.mock.calls[0][0].data.data.content.find(
      (b) => b.type === 'ContactForm'
    );
    expect(block.props).toMatchObject({ formSlug: 'spring-enquiry', anchor: 'contact' });
    prismaMock.tx.form.create.mockClear();
    await createLandingPage({ name: 'Spring', slug: 'spring', template: 'blank' }, 'u1');
    expect(prismaMock.tx.form.create).not.toHaveBeenCalled();
  });

  it('409 when the slug is taken', async () => {
    prismaMock.tx.site.create.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2002' }));
    await expect(createLandingPage({ name: 'A', slug: 'a', template: 'blank' }, 'u1')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('404 when there is no project', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    await expect(createLandingPage({ name: 'A', slug: 'a', template: 'blank' }, 'u1')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('listLandingSites', () => {
  it('lists only live LANDING sites of the default project', async () => {
    prismaMock.site.findMany.mockResolvedValue([]);
    await listLandingSites();
    expect(prismaMock.site.findMany.mock.calls[0][0].where).toEqual({
      project_id: 'p1',
      type: 'LANDING',
      deleted_at: null,
    });
  });
});
