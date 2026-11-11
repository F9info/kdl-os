import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({
  prisma: {
    membershipPlan: { findMany: vi.fn() },
    membershipPaymentProvider: { findMany: vi.fn() },
    membershipSetting: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock('../../config/database.js', () => db);
vi.mock('../../config/redis.js', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), publish: vi.fn() } }));
vi.mock('../auth/service.js', () => ({ hashPassword: vi.fn(), signAccessToken: vi.fn(), signRefreshToken: vi.fn(), storeRefreshToken: vi.fn() }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn(), getClientIp: () => null }));
vi.mock('../user-management/shared/permission-resolver.js', () => ({ resolvePermissions: vi.fn().mockResolvedValue({ bypass: false, permissions: [] }) }));

const { default: router } = await import('./routes.js');
const { errorHandler } = await import('../../middleware/errorHandler.js');
const app = express();
app.use(express.json({ verify: (req, _r, buf) => (req.rawBody = buf) }));
app.use('/api/membership', router);
app.use(errorHandler);

beforeEach(() => vi.clearAllMocks());

describe('public routes', () => {
  it('GET /plans lists public plans with the GST breakdown, no login needed', async () => {
    db.prisma.membershipPlan.findMany.mockResolvedValue([
      { id: 'p1', slug: 'silver', name: 'Silver', prices: [{ id: 'x', interval: 'YEARLY', amount: 100000, gst_rate: 18, tax_mode: 'EXCLUSIVE' }], benefits: [{ text: 'Perk' }] },
    ]);
    const res = await request(app).get('/api/membership/plans');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items[0].prices[0].breakdown).toEqual({ subtotal: 100000, tax: 18000, total: 118000 });
    expect(db.prisma.membershipPlan.findMany.mock.calls[0][0].where).toEqual({ visibility: 'PUBLIC', status: 'ACTIVE' });
  });

  it('POST /signup validates the body before touching the database', async () => {
    const res = await request(app).post('/api/membership/signup').send({ plan_slug: 'silver', email: 'nope' });
    expect(res.status).toBe(422);
    expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('POST /webhooks/razorpay rejects a call that no provider secret verifies', async () => {
    db.prisma.membershipPaymentProvider.findMany.mockResolvedValue([]);
    const res = await request(app).post('/api/membership/webhooks/razorpay').set('x-razorpay-signature', 'bad').send({ event: 'payment.captured' });
    expect(res.status).toBe(400);
  });

  it('POST /webhooks/stripe is a 404 (driver not built)', async () => {
    const res = await request(app).post('/api/membership/webhooks/stripe').send({});
    expect(res.status).toBe(404);
  });
});

describe('protected routes', () => {
  const calls = [
    ['get', '/api/membership/admin/overview'],
    ['get', '/api/membership/admin/members'],
    ['post', '/api/membership/admin/plans'],
    ['get', '/api/membership/admin/payment-providers'],
    ['put', '/api/membership/admin/settings'],
    ['get', '/api/membership/me'],
    ['post', '/api/membership/checkout'],
  ];
  it.each(calls)('%s %s without a token is 401', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });
});
