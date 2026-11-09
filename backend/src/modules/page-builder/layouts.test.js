import { describe, it, expect, vi } from 'vitest';

const createPage = vi.fn(async (a) => ({ id: 'new', ...a }));
vi.mock('./service.js', () => ({ createPage: (a, u) => createPage(a, u) }));
vi.mock('../../config/database.js', () => ({ prisma: {} }));

const { duplicatePage, saveAsLayout, createFromLayout } = await import('./layouts.js');

const body = { root: { props: { title: 'T' } }, content: [{ type: 'Hero', props: { id: 'h' } }], zones: {} };
// A fake client: pages is the table (deleted rows included, as in the real one).
const client = (pages = [], templates = []) => ({
  builderPage: {
    findFirst: async ({ where }) =>
      pages.find((p) => (!where.id || p.id === where.id) && (!where.slug || p.slug === where.slug) && p.project_id === where.project_id && (where.deleted_at !== null || !p.deleted_at)) ?? null,
    update: async ({ data }) => ({ id: 'new', ...data }),
  },
  template: {
    create: async ({ data }) => ({ ...data }),
    findFirst: async ({ where }) => templates.find((t) => t.key === where.key && t.kind === where.kind) ?? null,
  },
});
const src = { id: 'p1', slug: 'about', title: 'About', project_id: 'A', data: body, draft_data: null, seo: null, template_id: null, deleted_at: null };

describe('duplicatePage', () => {
  it('copies the content into a new draft in the same project with a free slug', async () => {
    await duplicatePage('p1', {}, 'u', 'A', client([src, { ...src, id: 'p2', slug: 'about-copy' }]));
    const arg = createPage.mock.calls.at(-1)[0];
    expect(arg).toMatchObject({ title: 'About (copy)', slug: 'about-copy-2', project_id: 'A' });
    expect(arg.data).toEqual(body);
    expect(arg.data).not.toBe(body); // a real copy
  });

  it('uses the pending draft when there is one', async () => {
    const draft = { ...body, content: [] };
    await duplicatePage('p1', {}, 'u', 'A', client([{ ...src, draft_data: draft }]));
    expect(createPage.mock.calls.at(-1)[0].data.content).toEqual([]);
  });

  it('a page of another project is a 404 (isolation)', async () => {
    await expect(duplicatePage('p1', {}, 'u', 'B', client([src]))).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a details-page instance and a taken explicit slug', async () => {
    await expect(duplicatePage('p1', {}, 'u', 'A', client([{ ...src, template_id: 't' }]))).rejects.toMatchObject({ status: 409 });
    await expect(duplicatePage('p1', { slug: 'about' }, 'u', 'A', client([src]))).rejects.toMatchObject({ status: 409 });
  });

  it('keeps SEO but drops the canonical', async () => {
    const page = await duplicatePage('p1', {}, 'u', 'A', client([{ ...src, seo: { title: 'x', canonical: 'https://a/about' } }]));
    expect(page.seo).toEqual({ title: 'x' });
  });
});

describe('layouts', () => {
  it('saves a page as a PAGE layout and applies it to a new page', async () => {
    const layout = await saveAsLayout('p1', { name: 'About page' }, 'u', 'A', client([src]));
    expect(layout).toMatchObject({ kind: 'PAGE', name: 'About page', data: body });
    await createFromLayout({ layout_key: 'k', title: 'Team', slug: 'team' }, 'u', 'B', client([], [{ key: 'k', kind: 'PAGE', data: body }]));
    const arg = createPage.mock.calls.at(-1)[0];
    expect(arg).toMatchObject({ slug: 'team', project_id: 'B' });
    expect(arg.data.root.props.title).toBe('Team');
    expect(arg.data.content).toEqual(body.content);
  });

  it('an unknown layout is a 404 and a used slug is a 409', async () => {
    await expect(createFromLayout({ layout_key: 'x', title: 't', slug: 's' }, 'u', 'A', client())).rejects.toMatchObject({ status: 404 });
    await expect(
      createFromLayout({ layout_key: 'k', title: 't', slug: 'about' }, 'u', 'A', client([src], [{ key: 'k', kind: 'PAGE', data: body }]))
    ).rejects.toMatchObject({ status: 409 });
  });
});
