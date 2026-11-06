// OpenAPI 3.0 document generated at runtime from the REAL Express routers and the Zod schemas used by
// `validate(schema)`, so it cannot drift from the code. No dependency: routes are read from router
// stacks, schemas through ./zod-schema.js.
//
// How: `trackMounts(app)` (call once, before any app.use) records every `app.use('/prefix', ..., router)`
// so each router's prefix is known (Express 5 does not keep it). `validate()` tags its middleware with
// `.schema`; `authenticate` is recognised by its function name.
//
// Known limits: responses are not described (only 200/401/422 stubs); permission requirements are not
// listed (requirePermission returns anonymous closures); routers nested inside routers are skipped.
import { toJsonSchema } from './zod-schema.js';
import { API_VERSION } from '../../middleware/api-version.js';

const BODY_METHODS = new Set(['post', 'put', 'patch']);

export function trackMounts(app) {
  const mounts = [];
  const use = app.use.bind(app);
  app.use = (path, ...handlers) => {
    const last = handlers[handlers.length - 1];
    if (typeof path === 'string' && Array.isArray(last?.stack)) mounts.push([path, last]);
    return use(path, ...handlers);
  };
  app.locals.mounts = mounts;
}

const joinPath = (prefix, route) => `${prefix}/${route}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
const toOpenApiPath = (p) => p.replace(/:(\w+)\??/g, '{$1}');
const operationId = (method, p) => `${method}${p.replace(/[^A-Za-z0-9]+/g, '_')}`.replace(/_$/, '');

function schemaParts(handlers) {
  const tagged = handlers.map((h) => h.schema).filter(Boolean);
  const shape = (key) => tagged.map((s) => s?.shape?.[key]).find(Boolean);
  return { body: shape('body'), query: shape('query'), params: shape('params') };
}

function objectParams(zodObj, where, pathNames = []) {
  const json = zodObj ? toJsonSchema(zodObj) : { properties: {} };
  const props = json.properties ?? {};
  const names = where === 'path' ? pathNames : Object.keys(props);
  return names.map((name) => ({
    name,
    in: where,
    required: where === 'path' ? true : (json.required ?? []).includes(name),
    schema: props[name] ?? { type: 'string' },
  }));
}

export function buildSpec(mounts) {
  const paths = {};
  let versionedTags = new Set();

  for (const [prefix, router] of mounts) {
    if (prefix !== '/api' && !prefix.startsWith('/api/')) continue;
    let secured = false; // set once `router.use(authenticate)` has been seen
    for (const layer of router.stack) {
      if (!layer.route) {
        if (layer.handle?.name === 'authenticate') secured = true;
        continue;
      }
      const handlers = layer.route.stack.map((l) => l.handle);
      const routeSecured = secured || handlers.some((h) => h.name === 'authenticate');
      const routePaths = [].concat(layer.route.path);
      const parts = schemaParts(handlers);
      for (const rp of routePaths) {
        if (typeof rp !== 'string') continue;
        const full = joinPath(prefix, rp);
        const apiPath = toOpenApiPath(full.replace(/^\/api/, '') || '/');
        const pathNames = [...full.matchAll(/:(\w+)/g)].map((m) => m[1]);
        const tag = full.split('/')[2] ?? 'api';
        versionedTags.add(tag);
        for (const method of Object.keys(layer.route.methods)) {
          if (method === '_all') continue;
          paths[apiPath] ??= {};
          if (paths[apiPath][method]) continue; // first registration wins, as in Express
          const parameters = [
            ...objectParams(parts.params, 'path', pathNames),
            ...objectParams(parts.query, 'query'),
          ];
          const op = {
            tags: [tag],
            operationId: operationId(method, apiPath),
            summary: `${method.toUpperCase()} ${apiPath}`,
            ...(parameters.length ? { parameters } : {}),
            ...(routeSecured ? { security: [{ bearerAuth: [] }] } : {}),
            responses: {
              200: { description: 'OK' },
              ...(routeSecured ? { 401: { description: 'Unauthorized' } } : {}),
              ...(parts.body || parts.query || parts.params
                ? { 422: { description: 'Validation failed' } }
                : {}),
            },
          };
          if (parts.body && BODY_METHODS.has(method)) {
            op.requestBody = {
              required: true,
              content: { 'application/json': { schema: toJsonSchema(parts.body) } },
            };
          }
          paths[apiPath][method] = op;
        }
      }
    }
  }

  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
  return {
    openapi: '3.0.3',
    info: {
      title: 'KDL API',
      version: API_VERSION,
      description: 'Generated from the running routers and Zod schemas.',
    },
    servers: [{ url: '/api/v1' }],
    tags: [...versionedTags].sort().map((name) => ({ name })),
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths: sorted,
  };
}

/** Express handler: builds once (routes are fixed after startup) and serves the JSON. */
export function openApiHandler(app) {
  let cached;
  return (_req, res) => {
    cached ??= buildSpec(app.locals.mounts ?? []);
    res.json(cached);
  };
}
