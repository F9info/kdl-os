import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/config/database.js';
import userRoutes from '../../src/modules/users/routes.js';
import { agent, bearer } from '../helpers/app.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const makeApp = () => agent([{ path: '/api/users', router: userRoutes }]);

const mockUser = (overrides = {}) => ({
  id: overrides.id || 'usr_2',
  name: 'Bob',
  email: 'bob@example.com',
  role: overrides.role || 'USER',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('user privilege escalation regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN cannot assign SUPER_ADMIN role (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_target', role: 'USER' });
    prisma.user.findUnique.mockResolvedValue(target);

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }))
      .send({ name: 'Bob', role: 'SUPER_ADMIN' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN cannot modify a SUPER_ADMIN user (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_super', role: 'SUPER_ADMIN' });
    prisma.user.findUnique.mockResolvedValue(target);

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }))
      .send({ name: 'Should Fail' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN cannot delete a SUPER_ADMIN user (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_super', role: 'SUPER_ADMIN' });
    prisma.user.findUnique.mockResolvedValue(target);

    const res = await makeApp()
      .delete(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }));

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
