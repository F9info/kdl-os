import { describe, it, expect, vi } from 'vitest';

const upsert = vi.fn(async ({ create }) => ({ id: 'm', ...create, items: [] }));
const findFirst = vi.fn();
vi.mock('../../config/database.js', () => ({ prisma: { menu: { upsert: (a) => upsert(a) }, project: { findFirst: (a) => findFirst(a) } } }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));
vi.mock('./scaffold-page.js', () => ({ scaffoldPageForLabel: vi.fn() }));
vi.mock('../template-engine/site/unregister-page.js', () => ({ renameInWebsiteStage: vi.fn(), unregisterFromWebsiteStage: vi.fn() }));
vi.mock('../page-builder/service.js', () => ({ deletePage: vi.fn() }));
vi.mock('../detail-page-types/entries.service.js', () => ({ createType: vi.fn(), deleteType: vi.fn() }));

const { ensureMenu } = await import('./service.js');

describe('ensureMenu always belongs to a project (T04b)', () => {
  it('uses the named project, else the default project, never null', async () => {
    await ensureMenu({ project_id: 'A', key: 'header', name: 'H' });
    expect(upsert.mock.calls.at(-1)[0].create.project_id).toBe('A');
    findFirst.mockResolvedValueOnce({ id: 'default-id' });
    await ensureMenu({ key: 'header', name: 'H' });
    expect(upsert.mock.calls.at(-1)[0].create.project_id).toBe('default-id');
  });

  it('is a 409 when there is no project at all', async () => {
    findFirst.mockResolvedValue(null);
    await expect(ensureMenu({ key: 'header', name: 'H' })).rejects.toMatchObject({ status: 409 });
  });
});
