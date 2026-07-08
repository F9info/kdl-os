import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../config/database.js', () => ({
  prisma: {
    notificationTemplate: { findUnique: vi.fn() },
    notificationCategory: { findUnique: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    rbacRole: { findUnique: vi.fn() },
    userRole: { findMany: vi.fn() },
    appSetting: { findUnique: vi.fn() },
  },
}));

vi.mock('../../config/redis.js', () => ({
  redis: { publish: vi.fn().mockResolvedValue(1) },
}));

vi.mock('./notifications.queue.js', () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn(),
  })),
}));

vi.mock('../../shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../integrations/service.js', () => {
  class IntegrationsDisabledError extends Error {
    constructor() {
      super('Integrations module is disabled');
      this.name = 'IntegrationsDisabledError';
    }
  }
  return {
    dispatchMessage: vi.fn().mockResolvedValue(undefined),
    IntegrationsDisabledError,
  };
});

// ── Import after mocks ─────────────────────────────────────────────────────────

const { renderTemplate, stripScripts, filterByPreference, processBatch, notify } =
  await import('./service.js');
const { prisma } = await import('../../config/database.js');
const { notificationsQueue } = await import('./notifications.queue.js');
const integrationsMod = await import('../integrations/service.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBatchArgs(overrides = {}) {
  return {
    userIds: ['user-1'],
    categorySlug: 'account',
    title: 'Test notification',
    body: 'Test body',
    emailSubject: null,
    emailBody: null,
    smsBody: null,
    whatsappBody: null,
    data: {},
    channels: ['IN_APP'],
    actor_id: null,
    ...overrides,
  };
}

// ── renderTemplate ─────────────────────────────────────────────────────────────

describe('renderTemplate', () => {
  it('replaces known variables', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Prasanna' })).toBe('Hello Prasanna!');
  });

  it('missing variable renders blank, not {{var}}', () => {
    expect(renderTemplate('Hello {{name}}!', {})).toBe('Hello !');
  });

  it('multiple variables — missing ones are blank, present ones render', () => {
    const result = renderTemplate('{{a}} and {{b}}', { a: 'foo' });
    expect(result).toBe('foo and ');
  });

  it('null data value treated as blank', () => {
    expect(renderTemplate('{{x}}', { x: null })).toBe('');
  });

  it('never throws on missing variables', () => {
    expect(() => renderTemplate('{{a}} {{b}} {{c}}', {})).not.toThrow();
  });

  it('empty template returns empty string', () => {
    expect(renderTemplate('', { name: 'x' })).toBe('');
  });

  it('null template returns empty string', () => {
    expect(renderTemplate(null, {})).toBe('');
  });
});

// ── stripScripts ───────────────────────────────────────────────────────────────

describe('stripScripts (HTML sanitization)', () => {
  it('removes script tags from email body', () => {
    const input = '<p>Hello</p><script>alert(1)</script>';
    expect(stripScripts(input)).toBe('<p>Hello</p>');
  });

  it('removes script tags with attributes', () => {
    const input = '<p>Safe</p><script src="evil.js" defer></script>';
    expect(stripScripts(input)).not.toContain('<script');
    expect(stripScripts(input)).toContain('<p>Safe</p>');
  });

  it('preserves non-dangerous HTML', () => {
    const input = '<p>Hello <b>world</b></p>';
    expect(stripScripts(input)).toBe(input);
  });

  it('returns empty string for null input', () => {
    expect(stripScripts(null)).toBe('');
  });

  it('removes inline script content', () => {
    const input = 'Before<script>document.cookie = "stolen";</script>After';
    const result = stripScripts(input);
    expect(result).not.toContain('document.cookie');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });
});

// ── filterByPreference ─────────────────────────────────────────────────────────

describe('filterByPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.notificationCategory.findUnique.mockResolvedValue({ id: 'cat-id' });
    prisma.notificationPreference.findMany.mockResolvedValue([]);
  });

  it('default enabled — user with no preference row is included', async () => {
    const result = await filterByPreference(['user-1'], 'account', 'EMAIL');
    expect(result.has('user-1')).toBe(true);
  });

  it('default enabled — multiple users, no rows, all included', async () => {
    const result = await filterByPreference(['user-1', 'user-2', 'user-3'], 'account', 'IN_APP');
    expect(result.size).toBe(3);
  });

  it('opt-out respected — excludes user who disabled the channel', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([{ user_id: 'user-1' }]);
    const result = await filterByPreference(['user-1', 'user-2'], 'account', 'EMAIL');
    expect(result.has('user-1')).toBe(false);
    expect(result.has('user-2')).toBe(true);
  });

  it('opt-out respected — all users disabled → empty set', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([
      { user_id: 'user-1' },
      { user_id: 'user-2' },
    ]);
    const result = await filterByPreference(['user-1', 'user-2'], 'account', 'SMS');
    expect(result.size).toBe(0);
  });

  it('security category + IN_APP ignores opt-out (always delivered)', async () => {
    // Even with explicit opt-out rows, security IN_APP is forced through
    prisma.notificationPreference.findMany.mockResolvedValue([{ user_id: 'user-1' }]);
    const result = await filterByPreference(['user-1'], 'security', 'IN_APP');
    expect(result.has('user-1')).toBe(true);
    // Should short-circuit without calling prisma at all
    expect(prisma.notificationCategory.findUnique).not.toHaveBeenCalled();
    expect(prisma.notificationPreference.findMany).not.toHaveBeenCalled();
  });

  it('security category + EMAIL channel respects opt-out', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([{ user_id: 'user-1' }]);
    const result = await filterByPreference(['user-1'], 'security', 'EMAIL');
    expect(result.has('user-1')).toBe(false);
  });

  it('unknown category (no prisma row) passes all users through', async () => {
    prisma.notificationCategory.findUnique.mockResolvedValue(null);
    const result = await filterByPreference(['user-1'], 'unknown-cat', 'IN_APP');
    expect(result.has('user-1')).toBe(true);
  });
});

// ── integrations-disabled skip path ───────────────────────────────────────────

describe('processBatch — integrations-disabled skip path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.notificationCategory.findUnique.mockResolvedValue({ id: 'cat-id' });
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      user_id: 'user-1',
      title: 'Test notification',
      body: 'Test body',
      data: null,
      created_at: new Date(),
    });
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ email: 'user@test.com', phone: null });
    integrationsMod.dispatchMessage.mockRejectedValue(
      new integrationsMod.IntegrationsDisabledError()
    );
  });

  it('does not throw when integrations is disabled', async () => {
    await expect(
      processBatch(makeBatchArgs({ channels: ['IN_APP', 'EMAIL'], emailBody: '<p>Hi</p>' }))
    ).resolves.toBeUndefined();
  });

  it('IN_APP still delivered even when EMAIL integration is disabled', async () => {
    await processBatch(
      makeBatchArgs({ channels: ['IN_APP', 'EMAIL'], emailBody: '<p>Hi</p>' })
    );
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('only logs the disabled message once even with multiple users', async () => {
    const { writeActivityAsync } = await import('../user-management/shared/activity-logger.js');
    await processBatch(
      makeBatchArgs({
        userIds: ['user-1', 'user-2', 'user-3'],
        channels: ['EMAIL'],
        emailBody: '<p>Hi</p>',
      })
    );
    // writeActivityAsync called exactly once per channel (log-once semantics)
    const emailSkipCalls = writeActivityAsync.mock.calls.filter((args) =>
      args[0]?.description?.includes('EMAIL')
    );
    expect(emailSkipCalls.length).toBe(1);
  });
});

// ── chunking ──────────────────────────────────────────────────────────────────

describe('processBatch — chunking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.notificationCategory.findUnique.mockResolvedValue({ id: 'cat-id' });
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    // service.js creates individually to capture IDs for Redis publish
    prisma.notification.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `notif-${data.user_id}`,
        user_id: data.user_id,
        title: data.title,
        body: data.body,
        data: data.data ?? null,
        created_at: new Date(),
      })
    );
    prisma.notification.findMany.mockResolvedValue([]);
  });

  it('501 users results in 501 create calls (one per user across 2 chunks)', async () => {
    const userIds = Array.from({ length: 501 }, (_, i) => `user-${i}`);
    await processBatch(makeBatchArgs({ userIds, channels: ['IN_APP'] }));
    expect(prisma.notification.create).toHaveBeenCalledTimes(501);
  });

  it('501 users loops through 2 chunks (verified via 2 preference queries)', async () => {
    const userIds = Array.from({ length: 501 }, (_, i) => `user-${i}`);
    await processBatch(makeBatchArgs({ userIds, channels: ['IN_APP'] }));
    // filterByPreference is called once per chunk per channel
    expect(prisma.notificationPreference.findMany).toHaveBeenCalledTimes(2);
  });

  it('first chunk queries preferences for up to 500 users', async () => {
    const userIds = Array.from({ length: 501 }, (_, i) => `user-${i}`);
    await processBatch(makeBatchArgs({ userIds, channels: ['IN_APP'] }));
    const firstCall = prisma.notificationPreference.findMany.mock.calls[0][0];
    expect(firstCall.where.user_id.in).toHaveLength(500);
  });

  it('second chunk queries preferences for the remaining 1 user', async () => {
    const userIds = Array.from({ length: 501 }, (_, i) => `user-${i}`);
    await processBatch(makeBatchArgs({ userIds, channels: ['IN_APP'] }));
    const secondCall = prisma.notificationPreference.findMany.mock.calls[1][0];
    expect(secondCall.where.user_id.in).toHaveLength(1);
  });

  it('exactly 500 users = 1 chunk (1 preference query, 500 creates)', async () => {
    const userIds = Array.from({ length: 500 }, (_, i) => `user-${i}`);
    await processBatch(makeBatchArgs({ userIds, channels: ['IN_APP'] }));
    expect(prisma.notificationPreference.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(500);
  });
});

// ── notify() queuing ───────────────────────────────────────────────────────────

describe('notify — queuing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ id: `user-${i}` }))
    );
  });

  it('returns batch_id for large recipient sets (role/all)', async () => {
    const result = await notify({
      to: { all: true },
      inline: { title: 'Broadcast', body: 'Hello' },
      channels: ['IN_APP'],
    });
    expect(result).toHaveProperty('batch_id');
    expect(notificationsQueue.add).toHaveBeenCalledWith('notify-batch', expect.any(Object));
  });
});
