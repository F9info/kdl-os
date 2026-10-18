// Public (unauthenticated) list routes reuse the admin list handlers, which honour
// `?is_active=` from the query string. Without this, anyone could call
// `/api/faq/public?is_active=false` and read hidden/unpublished records. Mount it
// right after validate() on every public list route: it overrides whatever the
// client sent, so only active rows can ever be returned.
export function publicOnlyActive(req, _res, next) {
  req.validated = { ...req.validated, query: { ...req.validated?.query, is_active: 'true' } };
  next();
}
