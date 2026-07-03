import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';

import { authenticate } from '../src/middleware/auth.js';

function mockRes() {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.jsonBody = body;
    return res;
  });
  return res;
}

describe('ai-services auth middleware regression — HS256 enforcement (KDL-26 M7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a token signed with HS256', () => {
    const token = jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = mockRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ userId: 'u1' });
  });

  it('rejects a token signed with a non-HS256 algorithm', () => {
    const token = jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET, { algorithm: 'HS384' });
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const res = mockRes();
    const next = vi.fn();
    authenticate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody.success).toBe(false);
  });
});
