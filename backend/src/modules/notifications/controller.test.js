import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../config/database.js', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    notificationCategory: { findMany: vi.fn() },
    notificationPreference: { findMany: vi.fn(), upsert: vi.fn() },
    notificationTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../config/redis.js', () => ({
  redis: { publish: vi.fn(), incr: vi.fn(), expire: vi.fn(), decr: vi.fn(), del: vi.fn() },
}));

vi.mock('../../shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('./service.js', () => ({
  notify: vi.fn(),
  renderTemplate: vi.fn((text, data) => {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? '');
  }),
  getNotificationTemplate: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), close: vi.fn() })),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

const { prisma } = await import('../../config/database.js');
const { notify, renderTemplate } = await import('./service.js');

const {
  listOwnNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteOwnNotification,
  getOwnPreferences,
  updateOwnPreferences,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  broadcast,
  listCategories,
  createCategory,
  updateCategory,
} = await import('./controller.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    user: { id: 'user-a', roles: [] },
    query: {},
    params: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Own-data isolation ─────────────────────────────────────────────────────────

describe('own-data isolation', () => {
  describe('markOneRead — 404 on another user\'s notification', () => {
    it('returns 404 when notification belongs to a different user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        user_id: 'user-b',
        read_at: null,
      });

      const req = makeReq({ user: { id: 'user-a' }, params: { id: 'notif-1' } });
      const res = makeRes();
      const next = vi.fn();

      await markOneRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('returns 404 when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      const req = makeReq({ params: { id: 'missing-id' } });
      const res = makeRes();
      const next = vi.fn();

      await markOneRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('marks notification read when it belongs to own user', async () => {
      const notif = { user_id: 'user-a', read_at: null };
      prisma.notification.findUnique.mockResolvedValue(notif);
      prisma.notification.update.mockResolvedValue({ ...notif, read_at: new Date() });

      const req = makeReq({ user: { id: 'user-a' }, params: { id: 'notif-1' } });
      const res = makeRes();
      const next = vi.fn();

      await markOneRead(req, res, next);

      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'notif-1' } })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('deleteOwnNotification — 404 on another user\'s notification', () => {
    it('returns 404 when notification belongs to a different user', async () => {
      prisma.notification.findUnique.mockResolvedValue({ user_id: 'user-b' });

      const req = makeReq({ user: { id: 'user-a' }, params: { id: 'notif-1' } });
      const res = makeRes();
      const next = vi.fn();

      await deleteOwnNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prisma.notification.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      const req = makeReq({ params: { id: 'missing-id' } });
      const res = makeRes();
      const next = vi.fn();

      await deleteOwnNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('deletes when notification belongs to own user', async () => {
      prisma.notification.findUnique.mockResolvedValue({ user_id: 'user-a' });
      prisma.notification.delete.mockResolvedValue({});

      const req = makeReq({ user: { id: 'user-a' }, params: { id: 'notif-1' } });
      const res = makeRes();
      const next = vi.fn();

      await deleteOwnNotification(req, res, next);

      expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('listOwnNotifications — scoped to own user_id', () => {
    it('queries only the requesting user\'s notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const req = makeReq({ user: { id: 'user-a' }, query: {} });
      const res = makeRes();
      const next = vi.fn();

      await listOwnNotifications(req, res, next);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ user_id: 'user-a' }) })
      );
    });

    it('applies unread filter when ?unread=true', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const req = makeReq({ user: { id: 'user-a' }, query: { unread: 'true' } });
      const res = makeRes();
      const next = vi.fn();

      await listOwnNotifications(req, res, next);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'user-a', read_at: null }),
        })
      );
    });
  });
});

// ── Broadcast — queues job, non-blocking ───────────────────────────────────────

describe('broadcast — queues a job, returns immediately', () => {
  it('calls notify() and returns its batch_id without blocking', async () => {
    notify.mockResolvedValue({ batch_id: 'batch-xyz', recipient_count: 250 });

    const req = makeReq({
      user: { id: 'admin-1' },
      body: {
        to: { all: true },
        inline: { title: 'Hello', body: 'World' },
        channels: ['IN_APP'],
      },
    });
    const res = makeRes();
    const next = vi.fn();

    await broadcast(req, res, next);

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { all: true },
        channels: ['IN_APP'],
        actor_id: 'admin-1',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ batch_id: 'batch-xyz' }),
      })
    );
  });

  it('returns 400 when "to" is missing', async () => {
    const req = makeReq({
      body: { inline: { title: 'Hi', body: 'Hey' }, channels: ['IN_APP'] },
    });
    const res = makeRes();
    const next = vi.fn();

    await broadcast(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(notify).not.toHaveBeenCalled();
  });

  it('returns 400 when neither template nor inline is provided', async () => {
    const req = makeReq({ body: { to: { all: true }, channels: ['IN_APP'] } });
    const res = makeRes();
    const next = vi.fn();

    await broadcast(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(notify).not.toHaveBeenCalled();
  });
});

// ── Preview — renders per channel ─────────────────────────────────────────────

describe('previewTemplate — renders each channel body', () => {
  it('renders all channel bodies with sample data', async () => {
    prisma.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      in_app_body: 'Hello {{name}}',
      email_subject: 'Welcome {{name}}',
      email_body: '<p>Dear {{name}}</p>',
      sms_body: 'Hi {{name}}',
      whatsapp_body: 'Hey {{name}}',
    });

    const req = makeReq({
      params: { id: 'tpl-1' },
      body: { data: { name: 'Prasanna' } },
    });
    const res = makeRes();
    const next = vi.fn();

    await previewTemplate(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          preview: expect.objectContaining({
            in_app: 'Hello Prasanna',
            email_subject: 'Welcome Prasanna',
            email_body: '<p>Dear Prasanna</p>',
            sms: 'Hi Prasanna',
            whatsapp: 'Hey Prasanna',
          }),
        }),
      })
    );
  });

  it('returns null for channels with no body configured', async () => {
    prisma.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-2',
      in_app_body: 'Notification',
      email_subject: null,
      email_body: null,
      sms_body: null,
      whatsapp_body: null,
    });

    const req = makeReq({ params: { id: 'tpl-2' }, body: { data: {} } });
    const res = makeRes();
    const next = vi.fn();

    await previewTemplate(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          preview: expect.objectContaining({
            in_app: 'Notification',
            email_subject: null,
            email_body: null,
            sms: null,
            whatsapp: null,
          }),
        }),
      })
    );
  });

  it('returns 404 for a missing template', async () => {
    prisma.notificationTemplate.findUnique.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'no-such-tpl' }, body: {} });
    const res = makeRes();
    const next = vi.fn();

    await previewTemplate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('uses empty object when no data provided', async () => {
    prisma.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-3',
      in_app_body: 'Hello {{name}}',
      email_subject: null,
      email_body: null,
      sms_body: null,
      whatsapp_body: null,
    });

    const req = makeReq({ params: { id: 'tpl-3' }, body: {} });
    const res = makeRes();
    const next = vi.fn();

    await previewTemplate(req, res, next);

    expect(renderTemplate).toHaveBeenCalledWith('Hello {{name}}', {});
  });
});

// ── deleteTemplate — 409 for system category templates ────────────────────────

describe('deleteTemplate', () => {
  it('returns 409 when template belongs to a system category', async () => {
    prisma.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-sys',
      slug: 'system.broadcast',
      category: { is_system: true },
    });

    const req = makeReq({ params: { id: 'tpl-sys' } });
    const res = makeRes();
    const next = vi.fn();

    await deleteTemplate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.notificationTemplate.delete).not.toHaveBeenCalled();
  });

  it('deletes template when category is not system', async () => {
    prisma.notificationTemplate.findUnique.mockResolvedValue({
      id: 'tpl-usr',
      slug: 'custom.alert',
      category: { is_system: false },
    });
    prisma.notificationTemplate.delete.mockResolvedValue({});

    const req = makeReq({ user: { id: 'admin-1' }, params: { id: 'tpl-usr' } });
    const res = makeRes();
    const next = vi.fn();

    await deleteTemplate(req, res, next);

    expect(prisma.notificationTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-usr' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
