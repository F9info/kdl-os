import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

vi.mock('../../middleware/module-gate.js', () => ({
  getModuleStatus: vi.fn(),
}));

vi.mock('../../modules/integrations/service.js', () => ({
  dispatchMessage: vi.fn(),
}));

vi.mock('../../config/redis.js', () => ({ redis: {} }));

const { getModuleStatus } = await import('../../middleware/module-gate.js');
const { dispatchMessage } = await import('../../modules/integrations/service.js');
const { sendEmail } = await import('./email.service.js');

beforeEach(() => {
  mockSendMail.mockResolvedValue({ messageId: 'smtp-ok' });
  dispatchMessage.mockResolvedValue({ logId: 'log-1' });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── integrations ENABLED path ───────────────────────────────────────────────

describe('sendEmail — integrations ENABLED', () => {
  beforeEach(() => {
    getModuleStatus.mockResolvedValue('ENABLED');
  });

  it('calls dispatchMessage with correct args', async () => {
    await sendEmail('user@example.com', 'Hello', '<p>Hi</p>');
    expect(dispatchMessage).toHaveBeenCalledWith({
      channel: 'EMAIL',
      source: 'core',
      to: 'user@example.com',
      subject: 'Hello',
      body: '<p>Hi</p>',
    });
  });

  it('returns dispatchMessage result', async () => {
    const result = await sendEmail('a@b.com', 'Sub', 'body');
    expect(result).toEqual({ logId: 'log-1' });
  });

  it('does not call SMTP sendMail', async () => {
    await sendEmail('a@b.com', 'Sub', 'body');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

// ─── integrations DISABLED / not present path ────────────────────────────────

describe('sendEmail — integrations DISABLED', () => {
  beforeEach(() => {
    getModuleStatus.mockResolvedValue('DISABLED');
  });

  it('calls SMTP sendMail with correct args', async () => {
    await sendEmail('user@example.com', 'Subject', '<p>body</p>');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', subject: 'Subject', html: '<p>body</p>' }),
    );
  });

  it('does not call dispatchMessage', async () => {
    await sendEmail('a@b.com', 'Sub', 'body');
    expect(dispatchMessage).not.toHaveBeenCalled();
  });
});

describe('sendEmail — integrations module absent (null status)', () => {
  beforeEach(() => {
    getModuleStatus.mockResolvedValue(null);
  });

  it('falls through to SMTP', async () => {
    await sendEmail('a@b.com', 'Sub', 'body');
    expect(mockSendMail).toHaveBeenCalled();
    expect(dispatchMessage).not.toHaveBeenCalled();
  });
});

// ─── error resilience (fall-through to SMTP) ─────────────────────────────────

describe('sendEmail — getModuleStatus throws', () => {
  it('falls through to SMTP when Redis/DB unavailable', async () => {
    getModuleStatus.mockRejectedValue(new Error('Redis down'));
    await sendEmail('user@example.com', 'Subject', '<p>body</p>');
    expect(dispatchMessage).not.toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });
});

describe('sendEmail — dispatchMessage throws', () => {
  it('falls through to SMTP when integrations service errors', async () => {
    getModuleStatus.mockResolvedValue('ENABLED');
    dispatchMessage.mockRejectedValue(new Error('Service unavailable'));
    await sendEmail('user@example.com', 'Subject', '<p>body</p>');
    expect(mockSendMail).toHaveBeenCalled();
  });
});
