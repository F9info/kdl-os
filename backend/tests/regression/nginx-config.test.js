/**
 * S2: the edge configs. These read the real files, so a change that drops a protection fails here:
 * nginx.conf (development and staging, plain HTTP) and nginx.prod.conf (production, TLS).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../../../infra/nginx/${f}`, import.meta.url), 'utf8');
const dev = read('nginx.conf');
const prod = read('nginx.prod.conf');

// The proxy locations, from the first one to the end of the last server block.
const locationsOf = (src) => src.slice(src.indexOf('    # Backend liveness'), src.lastIndexOf('  }\n}'));
// Everything that differs on purpose in production.
const norm = (s) => s.replace(/^\s*add_header Strict-Transport-Security .*\n/gm, '');

describe.each([
  ['nginx.conf', dev],
  ['nginx.prod.conf', prod],
])('%s', (_name, src) => {
  it('hides the nginx version', () => expect(src).toMatch(/server_tokens off;/));

  it('never trusts a client-sent X-Forwarded-For (it sets it to the connecting address)', () => {
    expect(src).not.toMatch(/\$proxy_add_x_forwarded_for/);
    expect(src).toMatch(/proxy_set_header X-Forwarded-For \$remote_addr;/);
    expect(src).toMatch(/proxy_set_header X-Forwarded-Proto \$scheme;/);
  });

  it('forwards a websocket upgrade only when asked (no forced "Connection: upgrade")', () => {
    expect(src).toMatch(/map \$http_upgrade \$connection_upgrade/);
    expect(src).not.toMatch(/proxy_set_header Connection 'upgrade';/);
  });

  it('rate-limits sign-in and the AI routes, answering 429', () => {
    expect(src).toMatch(/limit_req_zone .* zone=auth_zone/);
    expect(src).toMatch(/limit_req_zone .* zone=ai_zone/);
    expect(src).toMatch(/limit_req_status 429;/);
    expect(src).toMatch(/location \/api\/auth\/ \{\s+limit_req zone=auth_zone/);
    expect(src).toMatch(/location \/ai\/ \{\s+limit_req zone=ai_zone/);
  });

  it('keeps request bodies small except on the routes that take uploads', () => {
    expect(src).toMatch(/client_max_body_size 2M;/);
    expect(src).toMatch(/location \/api\/ \{\s+client_max_body_size 50M;/);
  });

  it('gives the public site the safe default headers', () => {
    const site = src.slice(src.lastIndexOf('    location / {'));
    for (const h of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      expect(site).toContain(`add_header ${h}`);
    }
  });

  it('does not add a blanket CSP at the proxy (the apps set their own)', () => {
    expect(src).not.toMatch(/add_header Content-Security-Policy/);
  });

  // A new server has no generated website yet: site-preview waits for one and nginx would answer 502
  // at /. Only nginx's own upstream errors are redirected (no proxy_intercept_errors: the site's own
  // 404/500 pages still reach the visitor).
  it('sends / to the admin login while the public site is not running, instead of a 502', () => {
    const site = src.slice(src.lastIndexOf('    location / {'));
    expect(site).toMatch(/error_page 502 503 504 = @no_site;/);
    expect(site).not.toMatch(/proxy_intercept_errors on/);
    // Relative Location: behind a mapped port (localhost:10100) an absolute one would drop the port.
    expect(src).toMatch(/location @no_site \{\s+absolute_redirect off;[^\n]*\s+return 302 \/login;\s+\}/);
  });

  // Uploaded files: the backend mints presigned URLs against the public host, so the browser fetches
  // https://<domain>/kdl-media/... and nginx passes it to MinIO. Read-only, and the Host header must be
  // the one the URL was signed for, or MinIO rejects the signature.
  it('serves the media bucket read-only from MinIO, keeping the signed Host', () => {
    const m = src.match(/location \^~ \/kdl-media\/ \{([\s\S]*?)\n    \}/);
    expect(m).not.toBeNull();
    const loc = m[1];
    expect(loc).toMatch(/limit_except GET HEAD \{\s+deny all;\s+\}/);
    expect(loc).toMatch(/set \$minio_host minio:9000;/);
    expect(loc).toMatch(/proxy_pass http:\/\/\$minio_host;/);
    expect(loc).toMatch(/proxy_set_header Host \$http_host;/);
  });
});

describe('nginx.prod.conf is the production edge', () => {
  it('only allows TLS 1.2 and 1.3, with no session tickets', () => {
    expect(prod).toMatch(/ssl_protocols TLSv1\.2 TLSv1\.3;/);
    expect(prod).not.toMatch(/TLSv1 |TLSv1\.1|SSLv3/);
    expect(prod).toMatch(/ssl_session_tickets off;/);
  });

  it('redirects plain HTTP to https and serves nothing else over it', () => {
    const http = prod.slice(prod.indexOf('listen 80;'), prod.indexOf('listen 443'));
    expect(http).toMatch(/return 301 https:\/\/\$host\$request_uri;/);
    expect(http).not.toMatch(/proxy_pass http:\/\/\$(frontend|site|ai)_host/);
  });

  it('sends HSTS from every location, including those that add their own headers', () => {
    expect(prod).toMatch(/add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;/);
    // nginx does not inherit add_header into a location that has its own, so each such location repeats it.
    for (const loc of prod.split(/\n    location /).slice(1)) {
      if (/add_header (?!Strict-Transport-Security)/.test(loc)) {
        expect(loc, `a location with its own add_header must repeat HSTS:\n${loc.slice(0, 80)}`).toContain('Strict-Transport-Security');
      }
    }
  });

  it('drops the upstream HSTS so there is exactly one', () => {
    expect(prod).toMatch(/proxy_hide_header Strict-Transport-Security;/);
  });

  it('has the same proxy locations as the development config (only HSTS differs)', () => {
    expect(norm(locationsOf(prod))).toBe(norm(locationsOf(dev)));
  });
});

describe('docker-compose.prod.yml', () => {
  const compose = readFileSync(new URL('../../../docker-compose.prod.yml', import.meta.url), 'utf8');

  it('requires an image tag and the first admin password, with no default for either', () => {
    expect(compose).toMatch(/\$\{IMAGE_TAG:\?/);
    // The images CD publishes: ghcr.io/<owner/repo>/<service> (cd.yml), not the old kalamdreamlabs path.
    for (const svc of ['backend', 'frontend', 'ai-services']) {
      expect(compose).toContain(`image: ghcr.io/\${IMAGE_REPO:-f9info/kdl-os}/${svc}:\${IMAGE_TAG:?`);
    }
    expect(compose).not.toContain('kalamdreamlabs');
    expect(compose).toMatch(/SEED_ADMIN_PASSWORD: \$\{SEED_ADMIN_PASSWORD:\?/);
    expect(compose).not.toMatch(/IMAGE_TAG:-latest/);
    expect(compose).not.toMatch(/kdl-dev-seed-password/);
  });

  it('mints media URLs for the public domain over https (not localhost:9002)', () => {
    const backend = compose.slice(compose.indexOf('  backend:'), compose.indexOf('  frontend:'));
    expect(backend).toMatch(/MINIO_PUBLIC_ENDPOINT: \$\{MINIO_PUBLIC_ENDPOINT:\?/);
    expect(backend).toMatch(/MINIO_PUBLIC_PORT: "?\$\{MINIO_PUBLIC_PORT:-443\}"?/);
    expect(backend).toMatch(/MINIO_PUBLIC_USE_SSL: "?\$\{MINIO_PUBLIC_USE_SSL:-true\}"?/);
  });

  it('runs the virus scanner and points the backend at it (uploads need a CLEAN scan in production)', () => {
    const clam = compose.slice(compose.indexOf('  clamav:'), compose.indexOf('  meilisearch:'));
    expect(clam).toMatch(/image: clamav\/clamav@sha256:[0-9a-f]{64}/);
    expect(clam).toMatch(/profiles: !reset \[\]/);
    const backend = compose.slice(compose.indexOf('  backend:'), compose.indexOf('  frontend:'));
    expect(backend).toMatch(/CLAMAV_HOST: clamav/);
    expect(backend).toMatch(/clamav:\s+condition: service_healthy/);
  });

  it('uses real SMTP (no MailHog) and starts MailHog only with the dev profile', () => {
    expect(compose).toMatch(/mailhog:\s+profiles: \["dev"\]/);
    expect(compose).toMatch(/SMTP_HOST: \$\{SMTP_HOST:\?/);
  });

  it('runs the public site with next start, not next dev', () => {
    const site = compose.slice(compose.indexOf('  site-preview:'), compose.indexOf('  nginx:'));
    expect(site).toContain('next start');
    expect(site).not.toContain('next dev');
  });

  it('pins every third-party image by digest', () => {
    const images = [...compose.matchAll(/^\s+image: (\S+)/gm)].map((m) => m[1]);
    const thirdParty = images.filter((i) => !i.startsWith('ghcr.io'));
    expect(thirdParty.length).toBeGreaterThanOrEqual(7);
    for (const i of thirdParty) expect(i).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  it('publishes only nginx, on 80 (redirect) and 443', () => {
    expect(compose).toMatch(/ports: !override\s+- "80:80"[^\n]*\s+- "443:443"/);
    expect((compose.match(/ports: !reset \[\]/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});

// Linux servers enforce file ownership on bind mounts (Docker Desktop on a Mac does not). The backend
// (uid 100) writes generated sites into ./frontend/projects, which site-preview builds and serves, so
// both run as uid 100:101 and a one-shot root step hands the folders to that user first.
describe('generated-site folder ownership (Linux servers)', () => {
  const base = readFileSync(new URL('../../../docker-compose.yml', import.meta.url), 'utf8');
  const prodCompose = readFileSync(new URL('../../../docker-compose.prod.yml', import.meta.url), 'utf8');
  const dockerfile = readFileSync(new URL('../../Dockerfile', import.meta.url), 'utf8');
  const service = (src, name) => {
    const start = src.indexOf(`\n  ${name}:\n`);
    if (start < 0) return '';
    const next = src.slice(start + 1).search(/\n  [a-z][a-z0-9-]*:\n|\nvolumes:/);
    return src.slice(start, next < 0 ? undefined : start + 1 + next);
  };

  it('pins the backend user to uid 100, gid 101', () => {
    expect(dockerfile).toMatch(/addgroup -S -g 101 nodejs && adduser -S -u 100 -G nodejs nodeuser/);
  });

  it('has a one-shot step that gives the site folders to 100:101', () => {
    const perms = service(base, 'site-perms');
    expect(perms).toMatch(/chown 100:101/);
    expect(perms).toContain('./frontend/projects:/sites');
    expect(perms).toContain('site_preview_modules:');
    expect(perms).toMatch(/restart: "no"/);
  });

  it('runs site-preview as 100:101 and starts it and the backend after that step', () => {
    const site = service(base, 'site-preview');
    expect(site).toMatch(/user: "100:101"/);
    expect(site).toMatch(/HOME: \/tmp/);
    for (const name of ['site-preview', 'backend']) {
      expect(service(base, name)).toMatch(/site-perms:\s+condition: service_completed_successfully/);
    }
  });

  it('pins the site-perms image by digest in production', () => {
    expect(service(prodCompose, 'site-perms')).toMatch(/image: node@sha256:[0-9a-f]{64}/);
  });
});
