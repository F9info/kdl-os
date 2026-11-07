# nginx edge

| File | Used for | Listens |
|---|---|---|
| `nginx.conf` | development and staging | plain HTTP on 127.0.0.1:80 |
| `nginx.prod.conf` | production | 443 (TLS 1.2+, HSTS), 80 only redirects to https and answers `/health` |

Keep `nginx.conf` self-contained: the staging deploy copies only that file. `backend/tests/regression/nginx-config.test.js`
reads both files and fails if the proxy locations drift apart or a protection is dropped.

## What both configs do

- Hide the nginx version.
- Pass the connecting address as `X-Forwarded-For` (never a client-sent one), so the app's rate limits cannot be fooled.
- Rate-limit `/api/auth/` and `/ai/` (429), and keep request bodies small (2M, 64k for sign-in), raising the limit only
  where uploads happen (`/api/` 50M, `/ai/` 30M).
- Add `nosniff`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` to the public website, which sets none of
  its own. The admin app and the API set theirs. No blanket Content-Security-Policy is added here: a generic one would
  break the site's inline scripts and media hosts.

## Production

1. Put the certificate and key in `infra/certs/` as `fullchain.pem` and `privkey.pem` (for example from Let's Encrypt).
   The folder is git-ignored. Check a renewal does not leave an expired file in place.
2. Set the required values in `.env` (see the header of `docker-compose.prod.yml`): `IMAGE_TAG`, `SEED_ADMIN_PASSWORD`,
   `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

Behind a load balancer that terminates TLS, set `NGINX_CONF=./infra/nginx/nginx.conf`, publish the stack only to the
load balancer, and make the load balancer send HSTS. In that setup the client address is the load balancer's, so
configure it to pass the real address and trust only it.

Check a change before deploying: `docker run --rm -v "$PWD/infra/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro" -v "$PWD/infra/certs:/etc/nginx/certs:ro" nginx:alpine nginx -t`
