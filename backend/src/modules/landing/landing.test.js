import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const prismaMock = vi.hoisted(() => {
  const tx = {
    site: { create: vi.fn(), update: vi.fn() },
    builderPage: { create: vi.fn(), update: vi.fn() },
    form: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  return {
    project: { findFirst: vi.fn() },
    site: { findMany: vi.fn(), findFirst: vi.fn() },
    template: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (fn) => fn(tx)),
    tx,
  };
});
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));

const { listLandingSites, createLandingPage, deleteLandingSite } = await import('./service.js');
const { listTemplates, buildLandingData, TEMPLATE_KEYS, LANDING_TEMPLATES } = await import('./templates.js');
const { handlePreview } = await import('./controller.js');
const { createLandingSchema } = await import('./schema.js');
const { manifestSchema } = await import('../../shared/modules/manifest-schema.js');

beforeEach(() => {
  vi.clearAllMocks();
  // The library table, seeded from the constants (what ensureBuiltinTemplates does).
  prismaMock.template.findMany.mockResolvedValue(
    Object.entries(LANDING_TEMPLATES).map(([key, t]) => ({ key, data: t.body('__slug__'), deleted_at: null }))
  );
  prismaMock.template.findFirst.mockImplementation(async ({ where }) => {
    const t = LANDING_TEMPLATES[where.key];
    return t && Object.hasOwn(LANDING_TEMPLATES, where.key)
      ? { id: where.key, key: where.key, name: t.name, data: t.body('__slug__'), has_form: !!t.hasForm }
      : null;
  });
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

  it('every template, Blank included, starts with the Landing header and ends with the Landing footer', () => {
    for (const key of TEMPLATE_KEYS) {
      const types = buildLandingData(key, 's', 'S').content.map((b) => b.type);
      expect(types[0], key).toBe('LandingHeader');
      expect(types.at(-1), key).toBe('LandingFooter');
    }
    // Blank is only the two; the others have a Landing hero right after the header.
    expect(buildLandingData('blank', 's', 'S').content).toHaveLength(2);
    for (const key of TEMPLATE_KEYS.filter((k) => k !== 'blank')) {
      expect(buildLandingData(key, 's', 'S').content[1].type).toBe('LandingHero');
    }
  });

  it('header and footer use the brand colours and hold no company details of their own', () => {
    for (const key of TEMPLATE_KEYS) {
      const content = buildLandingData(key, 's', 'S').content;
      for (const b of [content[0], content.at(-1)]) {
        expect(b.props.palette).toBe('brand');
        expect(JSON.stringify(b.props)).not.toMatch(/@|tel:|facebook|instagram|linkedin|logo/i);
      }
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
  it('rejects a bad slug and an empty name (an unknown template is a 404 from the library)', () => {
    expect(parse({ name: 'A', slug: 'Bad Slug' }).success).toBe(false);
    expect(parse({ name: ' ', slug: 'a' }).success).toBe(false);
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
      (b) => b.type === 'LandingForm'
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

  it('404 for a template key that is not in the library (or was deleted)', async () => {
    await expect(createLandingPage({ name: 'A', slug: 'a', template: 'nope' }, 'u1')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.tx.site.create).not.toHaveBeenCalled();
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

describe('handlePreview (View template)', () => {
  const call = async (key) => {
    const res = {
      statusCode: 200,
      body: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
    };
    await handlePreview({ params: { key } }, res, vi.fn());
    return res;
  };

  it('returns the page a template would create, without creating anything', async () => {
    const res = await call('lead-gen');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('Lead generation');
    expect(res.body.data.data.content[1].type).toBe('LandingHero'); // after the header
    expect(prismaMock.tx.builderPage.create).not.toHaveBeenCalled();
  });

  it('404 for an unknown template, including inherited object keys', async () => {
    expect((await call('nope')).statusCode).toBe(404);
    expect((await call('constructor')).statusCode).toBe(404);
    expect((await call('__proto__')).statusCode).toBe(404);
  });
});

describe('deleteLandingSite', () => {
  const live = {
    id: 's1',
    slug: 'spring',
    name: 'Spring',
    pages: [{ id: 'pg1', slug: 'spring' }],
  };

  it('soft-deletes the site, its pages and its enquiry form, and frees every slug for reuse', async () => {
    prismaMock.site.findFirst.mockResolvedValue(live);
    prismaMock.tx.form.findFirst.mockResolvedValue({ id: 'f1', slug: 'spring-enquiry' });
    await deleteLandingSite('s1', 'u1');

    const page = prismaMock.tx.builderPage.update.mock.calls[0][0];
    expect(page.where).toEqual({ id: 'pg1' });
    expect(page.data.deleted_at).toBeInstanceOf(Date);
    expect(page.data.slug).toMatch(/^spring--deleted-\d+$/);

    const form = prismaMock.tx.form.update.mock.calls[0][0];
    expect(form.where).toEqual({ id: 'f1' });
    expect(form.data.slug).toMatch(/^spring-enquiry--deleted-\d+$/);
    expect(form.data.deleted_at).toBeInstanceOf(Date);

    const site = prismaMock.tx.site.update.mock.calls[0][0];
    expect(site.data).toMatchObject({ domain: null });
    expect(site.data.slug).toMatch(/^spring--deleted-\d+$/);
    expect(site.data.deleted_at).toBeInstanceOf(Date);
  });

  it('only looks at a live LANDING site of the default project (never a website or another project)', async () => {
    prismaMock.site.findFirst.mockResolvedValue(live);
    prismaMock.tx.form.findFirst.mockResolvedValue(null);
    await deleteLandingSite('s1', 'u1');
    expect(prismaMock.site.findFirst.mock.calls[0][0].where).toEqual({
      id: 's1',
      project_id: 'p1',
      type: 'LANDING',
      deleted_at: null,
    });
    expect(prismaMock.tx.form.update).not.toHaveBeenCalled(); // blank template: no form to remove
  });

  it('404 when the landing page does not exist, is not a landing site, or is already deleted', async () => {
    prismaMock.site.findFirst.mockResolvedValue(null);
    await expect(deleteLandingSite('nope', 'u1')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('404 when there is no project', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    await expect(deleteLandingSite('s1', 'u1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('project from the request (T03b)', () => {
  it('lists the landing pages of the requested project and never asks for the default', async () => {
    prismaMock.site.findMany.mockResolvedValue([]);
    await listLandingSites(undefined, 'p2');
    expect(prismaMock.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ project_id: 'p2', type: 'LANDING' }) })
    );
    expect(prismaMock.project.findFirst).not.toHaveBeenCalled();
  });

  it('creates the landing page in the requested project', async () => {
    await createLandingPage({ name: 'Spring', slug: 'spring', template: 'blank' }, 'u1', undefined, 'p2');
    expect(prismaMock.tx.site.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ project_id: 'p2' }) })
    );
    expect(prismaMock.tx.builderPage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ project_id: 'p2' }) })
    );
  });

  it('will not delete a landing page that belongs to another project', async () => {
    prismaMock.site.findFirst.mockResolvedValue(null);
    await expect(deleteLandingSite('s1', 'u1', undefined, 'p2')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 's1', project_id: 'p2' }) })
    );
  });

  it('falls back to the default project when none is given', async () => {
    prismaMock.site.findMany.mockResolvedValue([]);
    await listLandingSites();
    expect(prismaMock.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ project_id: 'p1' }) })
    );
  });
});

const { ensureBuiltinTemplates } = await import('./template-library.js');

describe('built-in templates are refreshed when a release changes them', () => {
  it('rewrites a stored built-in whose body is out of date, keeping the name the user chose', async () => {
    const old = { key: 'lead-gen', data: [{ type: 'LandingHero', props: { id: 'x' } }], deleted_at: null };
    prismaMock.template.findMany.mockResolvedValue([old]);
    await ensureBuiltinTemplates(prismaMock);
    const update = prismaMock.template.update.mock.calls.find((c) => c[0].where.key === 'lead-gen');
    expect(update[0].data.data[0].type).toBe('LandingHeader');
    expect(update[0].data).not.toHaveProperty('name');
  });

  it('leaves an up-to-date built-in alone, and does not bring back one the user deleted', async () => {
    const fresh = Object.entries(LANDING_TEMPLATES).map(([key, t]) => ({ key, data: t.body('__slug__'), deleted_at: null }));
    fresh[1].deleted_at = new Date();
    fresh[1].data = [];
    prismaMock.template.findMany.mockResolvedValue(fresh);
    await ensureBuiltinTemplates(prismaMock);
    expect(prismaMock.template.update).not.toHaveBeenCalled();
    expect(prismaMock.template.upsert).not.toHaveBeenCalled();
  });

  it('compares bodies whatever order the database returns object keys in', async () => {
    const reorder = (v) =>
      Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)])) : v;
    prismaMock.template.findMany.mockResolvedValue(
      Object.entries(LANDING_TEMPLATES).map(([key, t]) => ({ key, data: reorder(t.body('__slug__')), deleted_at: null }))
    );
    await ensureBuiltinTemplates(prismaMock);
    expect(prismaMock.template.update).not.toHaveBeenCalled();
  });
});
