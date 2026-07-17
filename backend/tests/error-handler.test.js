import { describe, it, expect, vi, afterEach } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';

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

const req = { path: '/api/test', method: 'GET' };
const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe('errorHandler — 500 masking (KDL-270 M8)', () => {
  it.each(['production', 'staging', 'test'])('masks 500 details when NODE_ENV=%s', (env) => {
    process.env.NODE_ENV = env;
    const res = mockRes();
    errorHandler(new Error('ECONNREFUSED postgres:5432 /app/src/db.js:12'), req, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody.message).toBe('Internal server error');
  });

  it('exposes the message only in development', () => {
    process.env.NODE_ENV = 'development';
    const res = mockRes();
    errorHandler(new Error('detailed dev error'), req, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody.message).toBe('detailed dev error');
  });

  it('keeps explicit non-500 error messages client-visible', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    const err = Object.assign(new Error('Bucket not found'), { statusCode: 422 });
    errorHandler(err, req, res, vi.fn());

    expect(res.statusCode).toBe(422);
    expect(res.jsonBody.message).toBe('Bucket not found');
  });
});
