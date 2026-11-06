import { describe, it, expect } from 'vitest';
import express, { Router } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { toJsonSchema } from './zod-schema.js';
import { trackMounts, buildSpec, openApiHandler } from './spec.js';
import { validate } from '../../middleware/validate.js';

describe('toJsonSchema', () => {
  it('maps the Zod types the route schemas use', () => {
    const s = z.object({
      name: z.string().min(1).max(50),
      email: z.string().email().optional(),
      age: z.number().int().min(0),
      on: z.boolean().default(true),
      kind: z.enum(['a', 'b']),
      tags: z.array(z.string()),
      meta: z.record(z.string()),
      note: z.string().nullable(),
      when: z.string().datetime({ offset: true }).optional(),
      pick: z.union([z.string(), z.number()]),
      fixed: z.literal('x'),
    });
    const j = toJsonSchema(s);
    expect(j.type).toBe('object');
    expect(j.required.sort()).toEqual(['age', 'fixed', 'kind', 'meta', 'name', 'note', 'pick', 'tags']);
    expect(j.properties.name).toEqual({ type: 'string', minLength: 1, maxLength: 50 });
    expect(j.properties.email).toEqual({ type: 'string', format: 'email' });
    expect(j.properties.age).toEqual({ type: 'integer', minimum: 0 });
    expect(j.properties.on).toEqual({ type: 'boolean', default: true });
    expect(j.properties.kind).toEqual({ type: 'string', enum: ['a', 'b'] });
    expect(j.properties.tags).toEqual({ type: 'array', items: { type: 'string' } });
    expect(j.properties.note.nullable).toBe(true);
    expect(j.properties.when.format).toBe('date-time');
    expect(j.properties.pick.anyOf).toHaveLength(2);
    expect(j.properties.fixed).toEqual({ enum: ['x'] });
  });

  it('unwraps refinements and degrades unknown types to {} instead of throwing', () => {
    expect(toJsonSchema(z.string().refine(() => true))).toEqual({ type: 'string' });
    expect(toJsonSchema(z.any())).toEqual({});
    expect(toJsonSchema(undefined)).toEqual({});
  });
});

describe('buildSpec', () => {
  const authenticate = function authenticate(_req, _res, next) {
    next();
  };
  const build = () => {
    const app = express();
    trackMounts(app);
    const r = Router();
    r.get(
      '/public',
      validate(z.object({ query: z.object({ limit: z.string().optional(), q: z.string() }) })),
      (_q, s) => s.json({})
    );
    r.use(authenticate);
    r.get('/:id', validate(z.object({ params: z.object({ id: z.string().min(1) }) })), (_q, s) => s.json({}));
    r.post('/', validate(z.object({ body: z.object({ title: z.string() }) })), (_q, s) => s.json({}));
    app.use('/api/things', r);
    app.use(
      '/not-api',
      Router().get('/x', (_q, s) => s.json({}))
    );
    return app;
  };

  it('lists routes with params, query, body, security and skips non-/api mounts', () => {
    const spec = buildSpec(build().locals.mounts);
    expect(Object.keys(spec.paths)).toEqual(['/things', '/things/{id}', '/things/public']);

    const pub = spec.paths['/things/public'].get;
    expect(pub.security).toBeUndefined(); // before router.use(authenticate)
    expect(pub.parameters).toEqual([
      { name: 'limit', in: 'query', required: false, schema: { type: 'string' } },
      { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
    ]);

    const one = spec.paths['/things/{id}'].get;
    expect(one.security).toEqual([{ bearerAuth: [] }]);
    expect(one.parameters[0]).toMatchObject({ name: 'id', in: 'path', required: true });
    expect(one.responses[401]).toBeDefined();
    expect(one.responses[422]).toBeDefined();

    const post = spec.paths['/things'].post;
    expect(post.requestBody.content['application/json'].schema.required).toEqual(['title']);
    expect(spec.servers).toEqual([{ url: '/api/v1' }]);
    expect(spec.paths['/x']).toBeUndefined();
  });

  it('operationIds are unique and the handler serves the document', async () => {
    const app = build();
    app.get('/spec', openApiHandler(app));
    const res = await request(app).get('/spec').expect(200);
    const ids = Object.values(res.body.paths).flatMap((p) => Object.values(p).map((o) => o.operationId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.body.openapi).toBe('3.0.3');
  });
});
