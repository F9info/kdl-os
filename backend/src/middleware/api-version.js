// API versioning for native clients: `/api/v1/<path>` is an alias of `/api/<path>`.
// The path is rewritten before routing, so every module (core, auto-mounted, future) is reachable
// under /api/v1 with no per-route work, and `/api/*` keeps working for the web app. Every /api
// response carries `X-API-Version`. A future breaking change ships as /api/v2 with its own
// middleware; v1 stays frozen.
export const API_VERSION = '1';

const V1 = /^\/api\/v1(?=\/|\?|$)/;

export function apiVersion(req, res, next) {
  if (V1.test(req.url)) req.url = req.url.replace(V1, '/api');
  if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
    res.setHeader('X-API-Version', API_VERSION);
  }
  next();
}
