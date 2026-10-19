import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    menu: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    menuItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops) => Promise.all(ops)),
  },
}));

vi.mock('../src/modules/template-engine/site/queue.js', () => ({
  enqueueSiteBuild: vi.fn(),
}));

import { prisma } from '../src/config/database.js';
import {
  listMenus,
  getMenuById,
  getPublicMenu,
  ensureMenu,
  updateMenu,
  deleteMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  validateDepth,
} from '../src/modules/menus/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

beforeEach(() => vi.clearAllMocks());

// ---- validateDepth (exported pure function) --------------------------------

describe('menus service — validateDepth', () => {
  it('passes a flat list (depth 1)', () => {
    const items = [
      { id: 'a', parent_id: null, order: 0 },
      { id: 'b', parent_id: null, order: 1 },
    ];
    expect(() => validateDepth(items)).not.toThrow();
  });

  it('passes a valid 3-level tree', () => {
    const items = [
      { id: 'root', parent_id: null, order: 0 },
      { id: 'child', parent_id: 'root', order: 0 },
      { id: 'grandchild', parent_id: 'child', order: 0 },
    ];
    expect(() => validateDepth(items)).not.toThrow();
  });

  it('throws 422 when nesting exceeds MAX_DEPTH (3)', () => {
    const items = [
      { id: 'l1', parent_id: null, order: 0 },
      { id: 'l2', parent_id: 'l1', order: 0 },
      { id: 'l3', parent_id: 'l2', order: 0 },
      { id: 'l4', parent_id: 'l3', order: 0 }, // depth 4 — exceeds limit
    ];
    expect(() => validateDepth(items)).toThrow(/nest/i);
    try {
      validateDepth(items);
    } catch (err) {
      expect(err.status).toBe(422);
    }
  });

  it('throws 422 on a cycle', () => {
    const items = [
      { id: 'a', parent_id: 'b', order: 0 },
      { id: 'b', parent_id: 'a', order: 0 },
    ];
    expect(() => validateDepth(items)).toThrow(/cycle/i);
    try {
      validateDepth(items);
    } catch (err) {
      expect(err.status).toBe(422);
    }
  });

  it('treats a parent_id that is outside the batch as a root (depth 1)', () => {
    const items = [
      { id: 'child', parent_id: 'external-parent', order: 0 },
    ];
    expect(() => validateDepth(items)).not.toThrow();
  });
});

// ---- tree building (tested via listMenus / getMenuById) --------------------

describe('menus service — buildTree (via listMenus)', () => {
  it('returns tree-shaped menus ordered by item.order', async () => {
    const flatItems = [
      { id: 'c1', parent_id: 'root', order: 1, menu_id: 'm1' },
      { id: 'root', parent_id: null, order: 0, menu_id: 'm1' },
    ];
    const menu = { id: 'm1', name: 'Header', items: flatItems };
    prismaMock.menu.findMany.mockResolvedValue([menu]);

    const result = await listMenus({});

    expect(result).toHaveLength(1);
    expect(result[0].items[0].id).toBe('root');
    expect(result[0].items[0].children[0].id).toBe('c1');
  });

  it('filters by project_id when supplied', async () => {
    prismaMock.menu.findMany.mockResolvedValue([]);

    await listMenus({ project_id: 'proj1' });

    expect(prismaMock.menu.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project_id: 'proj1' } })
    );
  });
});

describe('menus service — getMenuById', () => {
  it('returns null when menu not found', async () => {
    prismaMock.menu.findUnique.mockResolvedValue(null);
    expect(await getMenuById('missing')).toBeNull();
  });

  it('returns tree-shaped menu when found', async () => {
    const menu = { id: 'm1', name: 'Footer', items: [{ id: 'i1', parent_id: null, order: 0 }] };
    prismaMock.menu.findUnique.mockResolvedValue(menu);

    const result = await getMenuById('m1');

    expect(result.id).toBe('m1');
    expect(result.items[0].children).toBeDefined();
  });
});

describe('menus service — getPublicMenu', () => {
  it('returns null (not an error) when no menu matches', async () => {
    prismaMock.menu.findFirst.mockResolvedValue(null);
    expect(await getPublicMenu('proj1', 'header')).toBeNull();
  });

  it('returns only active items tree-shaped', async () => {
    const menu = {
      id: 'm1',
      key: 'header',
      items: [{ id: 'i1', is_active: true, parent_id: null, order: 0 }],
    };
    prismaMock.menu.findFirst.mockResolvedValue(menu);

    const result = await getPublicMenu('proj1', 'header');

    expect(result.items).toHaveLength(1);
  });
});

describe('menus service — updateMenu', () => {
  it('returns null when menu not found', async () => {
    prismaMock.menu.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateMenu('missing', { name: 'New' })).toBeNull();
  });

  it('returns updated menu when found', async () => {
    prismaMock.menu.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: 'm1', name: 'New', items: [] };
    prismaMock.menu.findUnique.mockResolvedValue(updated);

    const result = await updateMenu('m1', { name: 'New' });

    expect(result.name).toBe('New');
  });
});

describe('menus service — deleteMenu', () => {
  it('returns false when menu not found', async () => {
    prismaMock.menu.findUnique.mockResolvedValue(null);
    prismaMock.menu.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteMenu('missing')).toBe(false);
  });
});

describe('menus service — createMenuItem', () => {
  it('creates a top-level item without depth check', async () => {
    const item = { id: 'i1', menu_id: 'm1', label: 'Home', parent_id: null };
    prismaMock.menuItem.create.mockResolvedValue(item);
    prismaMock.menu.findUnique.mockResolvedValue({ id: 'm1', project_id: 'proj1' });

    const result = await createMenuItem('m1', { label: 'Home', parent_id: null, order: 0 });

    expect(result.label).toBe('Home');
    expect(prismaMock.menuItem.create).toHaveBeenCalled();
  });

  it('throws 422 when parent chain already at MAX_DEPTH', async () => {
    // Simulate: l1 → l2 → l3 (depth 3); adding a child of l3 would make depth 4
    prismaMock.menuItem.findUnique
      .mockResolvedValueOnce({ id: 'l3', parent_id: 'l2' }) // grandparent
      .mockResolvedValueOnce({ id: 'l2', parent_id: 'l1' }) // great-grandparent
      .mockResolvedValueOnce({ id: 'l1', parent_id: null }); // root

    await expect(createMenuItem('m1', { label: 'Too deep', parent_id: 'l3', order: 0 })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('menus service — updateMenuItem', () => {
  it('returns null when item not found', async () => {
    prismaMock.menuItem.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateMenuItem('missing', { label: 'X' })).toBeNull();
  });
});

describe('menus service — deleteMenuItem', () => {
  it('returns false when item not found', async () => {
    prismaMock.menuItem.findUnique.mockResolvedValue(null);
    prismaMock.menuItem.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteMenuItem('missing')).toBe(false);
  });
});
