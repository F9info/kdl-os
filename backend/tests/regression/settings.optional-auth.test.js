import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/config/database.js';
import settingsRoutes from '../../src/modules/settings/routes.js';
import { agent, bearer } from '../helpers/app.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    appSetting: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

const makeApp = () => agent([{ path: '/api/settings', router: settingsRoutes }]);

const publicSetting = { key: 'site.name', value: 'KDL', type: 'STRING', is_public: true };
const privateSetting = { key: 'api.secret', value: 's3cr3t', type: 'STRING', is_public: false };

describe('settings optional authentication regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('anonymous users only see public settings in list (regression KDL-15)', async () => {
    prisma.appSetting.findMany.mockResolvedValue([publicSetting]);

    const res = await makeApp().get('/api/settings');

    expect(res.status).toBe(200);
    expect(prisma.appSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_public: true } })
    );
  });

  it('admin users see all settings in list (regression KDL-15)', async () => {
    prisma.appSetting.findMany.mockResolvedValue([publicSetting, privateSetting]);

    const res = await makeApp()
      .get('/api/settings')
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }));

    expect(res.status).toBe(200);
    expect(prisma.appSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('anonymous users cannot read a private single setting', async () => {
    prisma.appSetting.findUnique.mockResolvedValue(privateSetting);

    const res = await makeApp().get('/api/settings/api.secret');

    expect(res.status).toBe(403);
  });
});
