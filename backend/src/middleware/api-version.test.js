import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiVersion } from './api-version.js';

const app = express();
app.use(apiVersion);
app.get('/api/ping', (req, res) => res.json({ url: req.url, original: req.originalUrl, q: req.query }));
app.get('/api/v10/ping', (_req, res) => res.json({ hit: 'v10 route' }));
app.get('/health', (_req, res) => res.json({ ok: true }));

describe('apiVersion', () => {
  it('serves /api/v1/<path> from the same route as /api/<path>', async () => {
    const v1 = await request(app).get('/api/v1/ping?x=1').expect(200);
    const plain = await request(app).get('/api/ping?x=1').expect(200);
    expect(v1.body.url).toBe('/api/ping?x=1');
    expect(v1.body.q).toEqual({ x: '1' });
    expect(v1.body.original).toBe('/api/v1/ping?x=1');
    expect(plain.body.url).toBe(v1.body.url);
  });

  it('stamps X-API-Version on versioned and unversioned /api responses', async () => {
    expect((await request(app).get('/api/v1/ping')).headers['x-api-version']).toBe('1');
    expect((await request(app).get('/api/ping')).headers['x-api-version']).toBe('1');
  });

  it('does not touch non-api paths, nor treat /api/v10 as v1', async () => {
    expect((await request(app).get('/health')).headers['x-api-version']).toBeUndefined();
    expect((await request(app).get('/api/v10/ping').expect(200)).body.hit).toBe('v10 route');
  });

  it('an unknown path under v1 is a normal 404', async () => {
    await request(app).get('/api/v1/nope').expect(404);
  });
});
