/**
 * Menus module hardening: the URL allowlist (stored XSS + open redirect), the
 * 3-level depth limit, and menu-ownership checks on create/reorder.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  menu: { findUnique: vi.fn() },
  menuItem: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (ops) => ops),
}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));

import { safeUrl } from './schema.js';
import { createMenuItem, reorderMenuItems, validateDepth } from './service.js';

const ok = (v) => safeUrl.safeParse(v).success;

describe('menu item URL allowlist', () => {
  it.each([
    '/about', '/p/te-1-home?x=1#y', '#top', 'https://example.com/a', 'http://example.com',
    'mailto:a@b.com', 'tel:+911234567890', '', null, undefined,
  ])('allows %j', (v) => expect(ok(v)).toBe(true));

  it.each([
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', '  javascript:alert(1)', '\tjavascript:alert(1)',
    'data:text/html,<script>1</script>', 'vbscript:msgbox(1)', 'ftp://x.com', 'foo',
  ])('rejects scheme/garbage %j', (v) => expect(ok(v)).toBe(false));

  it.each(['//evil.com', '/\\evil.com', '/\\/evil.com', '/\t/evil.com', '/\n/evil.com', '/a\\b'])(
    'rejects open-redirect path %j',
    (v) => expect(ok(v)).toBe(false)
  );
});

describe('validateDepth', () => {
  const chain = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, parent_id: i ? `i${i - 1}` : null }));
  it('allows 3 levels, rejects 4', () => {
    expect(() => validateDepth(chain(3))).not.toThrow();
    expect(() => validateDepth(chain(4))).toThrow(/3 levels/);
  });
  it('rejects cycles', () => {
    expect(() => validateDepth([{ id: 'a', parent_id: 'b' }, { id: 'b', parent_id: 'a' }])).toThrow(/Cycle/);
  });
});

describe('createMenuItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a parent from another menu", async () => {
    prismaMock.menuItem.findUnique.mockResolvedValue({ menu_id: 'other-menu', parent_id: null });
    await expect(createMenuItem('m1', { parent_id: 'p', label: 'x' })).rejects.toMatchObject({ status: 422 });
    expect(prismaMock.menuItem.create).not.toHaveBeenCalled();
  });

  it('rejects a dangling parent id', async () => {
    prismaMock.menuItem.findUnique.mockResolvedValue(null);
    await expect(createMenuItem('m1', { parent_id: 'ghost', label: 'x' })).rejects.toMatchObject({ status: 422 });
  });

  it('creates under a parent of the same menu', async () => {
    prismaMock.menuItem.findUnique.mockResolvedValue({ menu_id: 'm1', parent_id: null });
    prismaMock.menuItem.create.mockResolvedValue({ id: 'new' });
    await expect(createMenuItem('m1', { parent_id: 'p', label: 'x' })).resolves.toEqual({ id: 'new' });
  });
});

describe('reorderMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.menu.findUnique.mockResolvedValue({ project_id: 'p1' });
  });
  const stored = [
    { id: 'a', parent_id: null },
    { id: 'b', parent_id: 'a' },
    { id: 'c', parent_id: 'b' }, // depth 3 already
    { id: 'd', parent_id: null },
  ];

  it("refuses to move an item that belongs to another menu", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue(stored);
    await expect(
      reorderMenuItems('m1', [{ id: 'FOREIGN', parent_id: null, order: 0 }])
    ).rejects.toMatchObject({ status: 422 });
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });

  it("refuses to parent an item under another menu's item", async () => {
    prismaMock.menuItem.findMany.mockResolvedValue(stored);
    await expect(
      reorderMenuItems('m1', [{ id: 'd', parent_id: 'FOREIGN', order: 0 }])
    ).rejects.toMatchObject({ status: 422 });
  });

  it('counts a parent outside the batch toward the depth limit', async () => {
    prismaMock.menuItem.findMany.mockResolvedValue(stored);
    // d -> under c (which is already level 3) = level 4, though c is not in the batch.
    await expect(
      reorderMenuItems('m1', [{ id: 'd', parent_id: 'c', order: 0 }])
    ).rejects.toThrow(/3 levels/);
    expect(prismaMock.menuItem.update).not.toHaveBeenCalled();
  });

  it('applies a valid reorder of own items', async () => {
    prismaMock.menuItem.findMany
      .mockResolvedValueOnce(stored)
      .mockResolvedValue([]); // getMenuById's follow-up read
    prismaMock.menu.findUnique.mockResolvedValue({ id: 'm1', project_id: 'p1', items: [] });
    await reorderMenuItems('m1', [{ id: 'd', parent_id: 'a', order: 1 }]);
    expect(prismaMock.menuItem.update).toHaveBeenCalledWith({
      where: { id: 'd' },
      data: { parent_id: 'a', order: 1 },
    });
  });
});
