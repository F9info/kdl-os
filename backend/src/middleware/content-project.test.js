/**
 * T06: project isolation on the content modules' admin routes. A caller who is not owner, member or super-admin
 * of a non-shared project gets 403 on every route that names that project (query, body, header) or addresses a
 * row of it by id. A list without a project shows only the request project; a new row lands in it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';

const rows = vi.hoisted(() => ({
  // model -> id -> row
  teamMember: {},
  menu: {},
  menuItem: {},
}));
const db = vi.hoisted(() => {
  const delegate = (model) => ({
    findFirst: vi.fn(async ({ where }) => rows[model]?.[where.id] ?? null),
  });
  return {
    prisma: { teamMember: delegate('teamMember'), menu: delegate('menu'), menuItem: delegate('menuItem'), project: { findFirst: vi.fn() } },
  };
});
const access = vi.hoisted(() => ({ getProjectForAccessCheck: vi.fn() }));
vi.mock('../config/database.js', () => db);
vi.mock('../modules/projects/service.js', () => access);
vi.mock('../modules/user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn().mockImplementation(async (userId) => ({ bypass: userId === 'admin', permissions: [] })),
}));

const { contentProject, recordProject } = await import('./content-project.js');
const { errorHandler } = await import('./errorHandler.js');

const PROJECTS = {
  pa: { id: 'pa', is_shared: false, created_by: 'owner-a', members: [{ user_id: 'member-a', role: 'member' }] },
  pb: { id: 'pb', is_shared: false, created_by: 'owner-b', members: [] },
  shared: { id: 'shared', is_shared: true, created_by: null, members: [] },
};

// A tiny router built the way the real modules are: authenticate, the two guards, then handlers that echo.
const app = express();
app.use(express.json());
const r = express.Router();
r.use((req, _res, next) => ((req.user = { id: req.get('x-user') ?? 'outsider' }), next()));
r.use(contentProject());
r.param('id', recordProject('teamMember'));
r.param('menuId', recordProject('menu'));
r.get('/', (req, res) => res.json({ project: req.projectId, query: req.query.project_id }));
r.post('/', (req, res) => res.json({ project: req.projectId, body: req.body.project_id }));
r.get('/:id', (req, res) => res.json({ id: req.params.id }));
r.patch('/:id', (req, res) => res.json({ id: req.params.id }));
app.use('/t', r);

// Menus, wired exactly like modules/menus/routes.js: one :id param for menus AND menu items.
const m = express.Router();
m.use((req, _res, next) => ((req.user = { id: req.get('x-user') ?? 'outsider' }), next()));
m.use(contentProject());
m.param('id', recordProject('menu', { itemModel: 'menuItem' }));
m.param('menuId', recordProject('menu'));
m.get('/:id', (req, res) => res.json({ menu: req.params.id }));
m.post('/:menuId/items', (req, res) => res.json({ menu: req.params.menuId }));
m.patch('/items/:id', (req, res) => res.json({ item: req.params.id }));
app.use('/m', m);
app.use(errorHandler);

beforeEach(() => {
  vi.clearAllMocks();
  rows.teamMember = { 'row-a': { project_id: 'pa' }, 'row-b': { project_id: 'pb' }, 'row-null': { project_id: null } };
  rows.menu = { 'menu-b': { project_id: 'pb' } };
  rows.menuItem = { 'item-b': { menu: { project_id: 'pb' } }, 'item-a': { menu: { project_id: 'pa' } } };
  db.prisma.project.findFirst.mockResolvedValue({ id: 'shared' }); // the default project
  access.getProjectForAccessCheck.mockImplementation(async (id) => {
    if (!PROJECTS[id]) throw Object.assign(new Error('Project not found'), { status: 404 });
    return PROJECTS[id];
  });
});

describe('the project a request names', () => {
  it('denies an outsider naming a private project in the query, body or header (403)', async () => {
    expect((await request(app).get('/t?project_id=pb')).status).toBe(403);
    expect((await request(app).post('/t').send({ project_id: 'pb' })).status).toBe(403);
    expect((await request(app).get('/t').set('x-project-id', 'pb')).status).toBe(403);
  });

  it('lets a member of that project in', async () => {
    const res = await request(app).get('/t?project_id=pa').set('x-user', 'member-a');
    expect(res.status).toBe(200);
    expect(res.body.project).toBe('pa');
  });

  it('lets a super-admin use any project', async () => {
    expect((await request(app).get('/t?project_id=pb').set('x-user', 'admin')).status).toBe(200);
  });

  it('answers 404 for an unknown project', async () => {
    expect((await request(app).get('/t?project_id=ghost').set('x-user', 'admin')).status).toBe(404);
  });

  it('a named project wins over the header, so a deep link to another project is checked, not the header', async () => {
    const res = await request(app).get('/t?project_id=pb').set('x-project-id', 'shared');
    expect(res.status).toBe(403);
  });
});

describe('every project id a handler could read is checked (no mixing a allowed id with a denied one)', () => {
  it('refuses a body and a query naming different projects (400), even when the caller may use both', async () => {
    const res = await request(app).get('/t?project_id=pb').set('x-user', 'admin').send({ project_id: 'pa' });
    expect(res.status).toBe(400);
  });

  it('refuses a JSON body that names an allowed project while the query names a denied one', async () => {
    const res = await request(app).get('/t?project_id=pb').set('x-user', 'member-a').send({ project_id: 'pa' });
    expect(res.status).toBe(400);
  });

  it('on a write, a denied project in the query cannot ride along with an allowed one in the body', async () => {
    const res = await request(app).patch('/t/row-a?project_id=pb').set('x-user', 'member-a').send({ project_id: 'pa' });
    expect(res.status).toBe(400);
  });

  it('accepts the same project named twice', async () => {
    const res = await request(app).patch('/t/row-a?project_id=pa').set('x-user', 'member-a').send({ project_id: 'pa' });
    expect(res.status).toBe(200);
  });

  it('checks the project it will act on, whichever of body or query carries it', async () => {
    expect((await request(app).get('/t').set('x-user', 'member-a').send({ project_id: 'pb' })).status).toBe(403);
  });

  it('ignores the header once a project is named, so a stale header cannot block or redirect the call', async () => {
    const res = await request(app).get('/t?project_id=pa').set('x-user', 'member-a').set('x-project-id', 'pb');
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('pa');
  });
});

describe('defaults', () => {
  it('a list without a project shows only the request project (header), never every project', async () => {
    const res = await request(app).get('/t').set('x-project-id', 'pa').set('x-user', 'member-a');
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('pa');
  });

  it('a list without any project falls back to the default project', async () => {
    const res = await request(app).get('/t');
    expect(res.body.query).toBe('shared');
  });

  it('a new row without a project lands in the request project', async () => {
    const res = await request(app).post('/t').set('x-project-id', 'pa').set('x-user', 'member-a').send({ name: 'x' });
    expect(res.body.body).toBe('pa');
  });

  it('keeps a project the client named on create', async () => {
    const res = await request(app).post('/t').set('x-user', 'member-a').send({ project_id: 'pa' });
    expect(res.body.body).toBe('pa');
  });
});

describe('rows addressed by id', () => {
  it("denies reading or editing another project's row (403), even with the right header for another project", async () => {
    expect((await request(app).get('/t/row-b')).status).toBe(403);
    expect((await request(app).patch('/t/row-b').send({})).status).toBe(403);
    expect((await request(app).get('/t/row-b').set('x-project-id', 'shared')).status).toBe(403);
  });

  it('allows a member to reach their own row', async () => {
    expect((await request(app).get('/t/row-a').set('x-user', 'member-a')).status).toBe(200);
  });

  it('denies moving a row of your project into a project you cannot use', async () => {
    const res = await request(app).patch('/t/row-a').set('x-user', 'member-a').send({ project_id: 'pb' });
    expect(res.status).toBe(403);
  });

  it('an unknown id passes through so the handler gives its usual 404', async () => {
    const res = await request(app).get('/t/nope').set('x-user', 'member-a');
    expect(res.status).toBe(200); // the stub handler answers; the real one returns not found
  });

  it('a row with no project counts as the default project (shared), so it stays reachable', async () => {
    expect((await request(app).get('/t/row-null')).status).toBe(200);
  });

  it('a menu item belongs to its menu\'s project', async () => {
    expect((await request(app).patch('/m/items/item-b').send({})).status).toBe(403);
    expect((await request(app).patch('/m/items/item-a').set('x-user', 'member-a').send({})).status).toBe(200);
  });

  it('the same :id means a menu on /:id and a menu item on /items/:id', async () => {
    rows.menu['shared-id'] = { project_id: 'shared' };
    rows.menuItem['shared-id'] = { menu: { project_id: 'pb' } };
    expect((await request(app).get('/m/shared-id')).status).toBe(200); // as a menu: shared project
    expect((await request(app).patch('/m/items/shared-id').send({})).status).toBe(403); // as an item: private project
  });

  it('a menu addressed by :menuId is checked too', async () => {
    expect((await request(app).post('/m/menu-b/items').send({})).status).toBe(403);
  });
});

describe('every content module is guarded (so a new module cannot forget)', () => {
  const MODELS = {
    team: 'teamMember', faq: 'faqEntry', sectors: 'sector', catalog: 'catalogItem', work: 'workCategory',
    gallery: 'galleryItem', testimonials: 'testimonial', 'projects-content': 'projectCaseStudy', menus: 'menu',
  };

  it.each(Object.entries(MODELS))('%s guards its admin routes after authenticate and keeps public routes open', (mod, model) => {
    const src = readFileSync(new URL(`../modules/${mod}/routes.js`, import.meta.url), 'utf8');
    const authAt = src.indexOf('router.use(authenticate);');
    const guardAt = src.indexOf('router.use(contentProject());');
    const paramAt = src.indexOf(`router.param('id', recordProject('${model}'`);
    expect(authAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(authAt);
    expect(paramAt).toBeGreaterThan(authAt);
    // Public routes are declared before the guard, so visitors are never blocked by it.
    const firstPublic = src.indexOf("router.get('/public'");
    if (firstPublic !== -1) expect(firstPublic).toBeLessThan(guardAt);
  });
});
