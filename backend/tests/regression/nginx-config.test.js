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
    expect(compose).toMatch(/SEED_ADMIN_PASSWORD: \$\{SEED_ADMIN_PASSWORD:\?/);
    expect(compose).not.toMatch(/IMAGE_TAG:-latest/);
    expect(compose).not.toMatch(/kdl-dev-seed-password/);
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
