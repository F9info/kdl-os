import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { publicOnlyActive } from './public-only-active.js';

describe('publicOnlyActive', () => {
  it('forces is_active=true whatever the client sent, keeping other filters', () => {
    const req = { validated: { query: { is_active: 'false', project_id: 'p1' } } };
    const next = vi.fn();
    publicOnlyActive(req, {}, next);
    expect(req.validated.query).toEqual({ is_active: 'true', project_id: 'p1' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('adds is_active when the client omitted it, and tolerates no validated query', () => {
    const a = { validated: { query: {} } };
    publicOnlyActive(a, {}, vi.fn());
    expect(a.validated.query.is_active).toBe('true');
    const b = {};
    publicOnlyActive(b, {}, vi.fn());
    expect(b.validated.query.is_active).toBe('true');
  });

  it('through a real route: ?is_active=false never reaches the handler', async () => {
    const seen = vi.fn();
    const app = express();
    app.get(
      '/public',
      (req, _res, next) => ((req.validated = { query: { ...req.query } }), next()), // stands in for validate()
      publicOnlyActive,
      (req, res) => (seen(req.validated.query), res.json({ ok: true }))
    );
    await request(app).get('/public?is_active=false&project_id=p1').expect(200);
    expect(seen).toHaveBeenCalledWith({ is_active: 'true', project_id: 'p1' });
  });
});
