import { describe, it, expect, vi } from 'vitest';

const h = vi.hoisted(() => ({ updateMany: vi.fn(), updateIdentity: vi.fn() }));
vi.mock('../../config/database.js', () => ({ prisma: { settingField: { updateMany: h.updateMany } } }));
vi.mock('../identity/service.js', () => ({ updateIdentity: h.updateIdentity }));
vi.mock('../template-engine/site/queue.js', () => ({
  enqueueAllSiteBuilds: vi.fn(),
  enqueueSiteBuild: vi.fn(),
}));
vi.mock('../../shared/services/storage.service.js', () => ({}));

const { setGlobalLogo } = await import('./service.js');

describe('setGlobalLogo keeps Application Identity in step', () => {
  it('writes the logo path to the legacy logo field AND to identity.logo_light', async () => {
    await setGlobalLogo('media/logo.png');
    expect(h.updateMany).toHaveBeenCalledWith({ where: { slug: 'logo' }, data: { value: 'media/logo.png' } });
    expect(h.updateIdentity).toHaveBeenCalledWith({ logo_light: 'media/logo.png' });
  });
});
