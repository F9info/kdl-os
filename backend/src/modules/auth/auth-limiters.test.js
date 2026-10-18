/**
 * Auth abuse limits. authLimiter skips successful requests, so signups and
 * forgot-password (always 200) were effectively unlimited. These tests run the
 * real router in production mode with controllers stubbed to always succeed.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../middleware/validate.js', () => ({ validate: () => (_q, _r, n) => n() }));
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (_q, _r, n) => n(),
  authenticateAllowPendingPasswordChange: (_q, _r, n) => n(),
}));
vi.mock('./controller.js', () => {
  const ok = (_req, res) => res.status(200).json({ ok: true });
  return {
    register: ok, login: ok, refresh: ok, logout: ok, forgotPassword: ok,
    resetPassword: ok, changePassword: ok, getMyPermissions: ok,
  };
});

let app;
beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production'); // limiters read this at import time
  const { default: router } = await import('./routes.js');
  app = express();
  app.use(express.json());
  app.use('/auth', router);
});

const post = (path, body) => request(app).post(`/auth${path}`).send(body);

describe('register', () => {
  it('blocks the 6th signup from one IP even though every one succeeds and uses a new email', async () => {
    for (let i = 0; i < 5; i += 1) {
      await post('/register', { email: `user${i}@x.com` }).expect(200);
    }
    const res = await post('/register', { email: 'user99@x.com' });
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/sign-ups/i);
  });
});

describe('forgot-password', () => {
  it('limits resets per target email (mail-bombing one victim)', async () => {
    for (let i = 0; i < 3; i += 1) {
      await post('/forgot-password', { email: 'victim@x.com' }).expect(200);
    }
    const res = await post('/forgot-password', { email: 'VICTIM@x.com ' });
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/this account/i);
  });

  it('a different email from the same IP is still served until the IP cap', async () => {
    await post('/forgot-password', { email: 'other@x.com' }).expect(200);
  });
});
