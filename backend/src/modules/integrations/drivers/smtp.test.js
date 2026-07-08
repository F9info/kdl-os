import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

// Import after mock so vi.mock hoisting applies
const { default: nodemailer } = await import('nodemailer');
const { default: driver } = await import('./smtp.js');

const CREDS = { host: 'smtp.example.com', port: 587, user: 'user@example.com', pass: 'secret' };
const CONFIG = { from: 'sender@example.com' };

describe('smtp driver — metadata', () => {
  it('has correct channel and driver name', () => {
    expect(driver.channel).toBe('EMAIL');
    expect(driver.driver).toBe('smtp');
  });

  it('credentialsSchema validates required fields', () => {
    expect(() => driver.credentialsSchema.parse(CREDS)).not.toThrow();
    expect(() => driver.credentialsSchema.parse({ ...CREDS, host: '' })).toThrow();
    expect(() => driver.credentialsSchema.parse({ ...CREDS, port: 99999 })).toThrow();
  });

  it('configSchema validates from address', () => {
    expect(() => driver.configSchema.parse(CONFIG)).not.toThrow();
    expect(() => driver.configSchema.parse({ from: 'not-an-email' })).toThrow();
  });
});

describe('smtp driver — send()', () => {
  let sendMailMock;

  beforeEach(() => {
    sendMailMock = vi.fn().mockResolvedValue({ messageId: '<abc123@example.com>' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
  });

  it('creates transporter with correct credentials', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: 'user@test.com', subject: 'Hi', body: '<p>Hello</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user@example.com', pass: 'secret' },
    });
  });

  it('uses port 465 → secure: true', async () => {
    await driver.send({
      credentials: { ...CREDS, port: 465 },
      config: CONFIG,
      to: 'user@test.com',
      body: 'hi',
    });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true, port: 465 }));
  });

  it('passes correct sendMail arguments', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: 'recv@test.com', subject: 'Test', body: '<b>body</b>' });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'sender@example.com',
      to: 'recv@test.com',
      subject: 'Test',
      html: '<b>body</b>',
    });
  });

  it('defaults subject to "(no subject)" when omitted', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: 'x@y.com', body: 'b' });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ subject: '(no subject)' }));
  });

  it('returns provider_ref from messageId', async () => {
    const result = await driver.send({ credentials: CREDS, config: CONFIG, to: 'x@y.com', body: 'b' });
    expect(result).toEqual({ provider_ref: '<abc123@example.com>' });
  });

  it('throws when sendMail rejects', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP auth failed'));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: 'x@y.com', body: 'b' })).rejects.toThrow('SMTP auth failed');
  });
});

describe('smtp driver — parseWebhook()', () => {
  it('always returns null (SMTP has no delivery webhook)', () => {
    expect(driver.parseWebhook({ body: {}, query: {} })).toBeNull();
    expect(driver.parseWebhook({})).toBeNull();
  });
});
