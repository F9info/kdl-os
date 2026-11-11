import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    membershipOtpCode: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    membershipSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    integrationProvider: { findFirst: vi.fn().mockResolvedValue(null) },
    member: { findFirst: vi.fn() },
  },
}));
vi.mock('../../../config/database.js', () => db);
vi.mock('../../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
const { sendOtp, checkOtp, debugCodeAllowed, mobileVariants, signSignupToken, verifySignupToken, normalizeMobile } = await import('./otp.service.js');

beforeEach(() => vi.clearAllMocks());

describe('dev_code fails closed', () => {
  it('only when OTP_DEBUG_RESPONSE=true AND NODE_ENV=development', () => {
    expect(debugCodeAllowed({ OTP_DEBUG_RESPONSE: 'true', NODE_ENV: 'development' })).toBe(true);
    for (const env of [{}, { NODE_ENV: 'development' }, { OTP_DEBUG_RESPONSE: 'true' }, { OTP_DEBUG_RESPONSE: 'true', NODE_ENV: 'test' }, { OTP_DEBUG_RESPONSE: 'true', NODE_ENV: 'staging' }, { OTP_DEBUG_RESPONSE: 'true', NODE_ENV: 'production' }, { OTP_DEBUG_RESPONSE: '1', NODE_ENV: 'development' }])
      expect(debugCodeAllowed(env)).toBe(false);
  });
  it('sendOtp never returns the code under test / unset NODE_ENV', async () => {
    db.prisma.membershipOtpCode.findMany.mockResolvedValue([]);
    const r = await sendOtp({ mobile: '9848012345' }, '1.2.3.4');
    expect(r).toMatchObject({ sent: true, expires_in: 300, resend_in: 30 });
    expect(r.dev_code).toBeUndefined();
    expect(db.prisma.membershipOtpCode.create.mock.calls[0][0].data.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('sendOtp limits', () => {
  it('30 s between sends, 3 per IP per hour, 5 per number per hour', async () => {
    const row = (secAgo, ip = 'x') => ({ created_at: new Date(Date.now() - secAgo * 1000), ip });
    db.prisma.membershipOtpCode.findMany.mockResolvedValue([row(10)]);
    await expect(sendOtp({ mobile: '9848012345' })).rejects.toMatchObject({ status: 429 });
    db.prisma.membershipOtpCode.findMany.mockResolvedValue([row(100, '9.9.9.9'), row(200, '9.9.9.9'), row(300, '9.9.9.9')]);
    await expect(sendOtp({ mobile: '9848012345' }, '9.9.9.9')).rejects.toMatchObject({ status: 429 });
    db.prisma.membershipOtpCode.findMany.mockResolvedValue([100, 200, 300, 400, 500].map((s, i) => row(s, `ip${i}`)));
    await expect(sendOtp({ mobile: '9848012345' }, 'new')).rejects.toMatchObject({ status: 429 });
  });
  it('rejects an invalid number', async () => {
    await expect(sendOtp({ mobile: '123' })).rejects.toMatchObject({ status: 422 });
  });
});

describe('checkOtp', () => {
  const mk = async (code) => {
    // hash through the real send path
    db.prisma.membershipOtpCode.findMany.mockResolvedValue([]);
    process.env.OTP_DEBUG_RESPONSE = 'true';
    process.env.NODE_ENV = 'development';
    const r = await sendOtp({ mobile: '9848012345' });
    process.env.NODE_ENV = 'test';
    delete process.env.OTP_DEBUG_RESPONSE;
    return { code: code ?? r.dev_code, hash: db.prisma.membershipOtpCode.create.mock.calls.at(-1)[0].data.code_hash };
  };
  it('accepts the right code once and consumes it', async () => {
    const { code, hash } = await mk();
    db.prisma.membershipOtpCode.findFirst.mockResolvedValue({ id: 'o1', code_hash: hash, attempts: 0, expires_at: new Date(Date.now() + 60_000) });
    expect(await checkOtp({ mobile: '9848012345', code })).toEqual({ mobile: '+919848012345' });
    expect(db.prisma.membershipOtpCode.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { consumed_at: expect.any(Date) } });
  });
  it('counts a wrong attempt on that code and refuses after 5', async () => {
    const { hash } = await mk();
    db.prisma.membershipOtpCode.findFirst.mockResolvedValue({ id: 'o1', code_hash: hash, attempts: 0, expires_at: new Date(Date.now() + 60_000) });
    await expect(checkOtp({ mobile: '9848012345', code: '000000' })).rejects.toMatchObject({ status: 400 });
    expect(db.prisma.membershipOtpCode.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { attempts: { increment: 1 } } });
    db.prisma.membershipOtpCode.findFirst.mockResolvedValue({ id: 'o1', code_hash: hash, attempts: 5, expires_at: new Date(Date.now() + 60_000) });
    await expect(checkOtp({ mobile: '9848012345', code: '123456' })).rejects.toMatchObject({ status: 429 });
  });
  it('expired or missing code is refused', async () => {
    db.prisma.membershipOtpCode.findFirst.mockResolvedValue(null);
    await expect(checkOtp({ mobile: '9848012345', code: '123456' })).rejects.toMatchObject({ status: 400 });
    db.prisma.membershipOtpCode.findFirst.mockResolvedValue({ id: 'o', code_hash: 'a'.repeat(64), attempts: 0, expires_at: new Date(Date.now() - 1) });
    await expect(checkOtp({ mobile: '9848012345', code: '123456' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('helpers', () => {
  it('matches every spelling of an Indian number', () => {
    expect(mobileVariants('+919848012345').sort()).toEqual(['+919848012345', '919848012345', '9848012345']);
    expect(normalizeMobile('98480 12345')).toBe('+919848012345');
  });
  it('signup token binds the verified mobile and rejects tampering', () => {
    const t = signSignupToken('+919848012345');
    expect(verifySignupToken(t)).toBe('+919848012345');
    expect(verifySignupToken(t + 'x')).toBeNull();
    expect(verifySignupToken('nope')).toBeNull();
  });
});
