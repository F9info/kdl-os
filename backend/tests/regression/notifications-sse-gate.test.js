import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Pass-through module gate — this suite targets the SSE auth middleware only.
vi.mock('../../src/middleware/module-gate.js', () => ({
  moduleGate: () => (_req, _res, next) => next(),
}));

// Stub the controller so the real router wiring (authenticateSSE on /stream)
// is exercised without opening a long-lived SSE connection.
vi.mock('../../src/modules/notifications/controller.js', () => ({
  listOwnNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markOneRead: vi.fn(),
  markAllRead: vi.fn(),
  deleteOwnNotification: vi.fn(),
  getOwnPreferences: vi.fn(),
  updateOwnPreferences: vi.fn(),
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  previewTemplate: vi.fn(),
  broadcast: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  sseStream: vi.fn((_req, res) => res.json({ success: true, data: 'stream-open' })),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../../src/config/database.js';
import notificationRoutes from '../../src/modules/notifications/routes.js';
import { agent, bearer } from '../helpers/app.js';

const makeApp = () => agent([{ path: '/api/notifications', router: notificationRoutes }]);

const mockUser = (overrides = {}) => ({
  id: 'usr_1',
  status: 'ACTIVE',
  deleted_at: null,
  must_change_password: false,
  ...overrides,
});

describe('SSE stream forced-password-change gate (KDL-309)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks the stream via header token while must_change_password is set', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

    const res = await makeApp()
      .get('/api/notifications/stream')
      .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }));

    expect(res.status).toBe(403);
    expect(res.body.errors.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('blocks the stream via ?token= query fallback while must_change_password is set', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));
    const token = jwt.sign({ userId: 'usr_1', email: 'admin@kdl.com' }, process.env.JWT_SECRET);

    const res = await makeApp().get(`/api/notifications/stream?token=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.errors.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('opens the stream once the flag is cleared (header token)', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser());

    const res = await makeApp()
      .get('/api/notifications/stream')
      .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }));

    expect(res.status).toBe(200);
    expect(res.body.data).toBe('stream-open');
  });

  it('opens the stream once the flag is cleared (query token fallback)', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser());
    const token = jwt.sign({ userId: 'usr_1', email: 'admin@kdl.com' }, process.env.JWT_SECRET);

    const res = await makeApp().get(`/api/notifications/stream?token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBe('stream-open');
  });

  it('still rejects a missing token with 401', async () => {
    const res = await makeApp().get('/api/notifications/stream');

    expect(res.status).toBe(401);
  });

  it('still rejects a suspended account with 403', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser({ status: 'SUSPENDED' }));

    const res = await makeApp()
      .get('/api/notifications/stream')
      .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }));

    expect(res.status).toBe(403);
    expect(res.body.errors?.code).not.toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
