import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({ prisma: {} }));
const { friendlyLinksFor } = await import('./page-routes-db.js');

const db = (rows) => ({ builderPage: { findMany: vi.fn(async () => rows) } });
const rows = [
  { id: '1', slug: 'demo-home', title: 'Home', route_key: 'home', status: 'PUBLISHED' },
  { id: '2', slug: 'demo-contact', title: 'Contact', route_key: 'contact', status: 'PUBLISHED' },
];

describe('friendlyLinksFor', () => {
  it('rewrites /p/<slug> links for a project, the front page to "/", and leaves unknown slugs', async () => {
    const out = await friendlyLinksFor('p1', { a: '/p/demo-contact', b: '/p/demo-home', c: '/p/ghost' }, db(rows));
    expect(out).toEqual({ a: '/contact', b: '/', c: '/p/ghost' });
  });

  it('asks only for this project and ignores deleted pages', async () => {
    const client = db(rows);
    await friendlyLinksFor('p1', { a: 1 }, client);
    expect(client.builderPage.findMany.mock.calls[0][0].where).toEqual({ project_id: 'p1', deleted_at: null });
  });

  it('with no project, or nothing to rewrite, it does not touch the database', async () => {
    const client = db(rows);
    expect(await friendlyLinksFor(null, { a: '/p/demo-contact' }, client)).toEqual({ a: '/p/demo-contact' });
    expect(await friendlyLinksFor('p1', null, client)).toBeNull();
    expect(client.builderPage.findMany).not.toHaveBeenCalled();
  });
});
