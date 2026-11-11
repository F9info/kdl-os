import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Contract: the public website only ever gets READ access under `/public/*`, plus the few
// endpoints a visitor or a webhook must call. Every other route needs a login (`authenticate`,
// directly or through `router.use(authenticate)`) and a permission. If this test fails you added an
// unauthenticated route: put it under `/public/*` (and keep it read-only), or add it to ALLOWED
// below with the reason. See docs/planning/09-admin-frontend-architecture.md.

const MODULES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules');

// [module, METHOD, path] -> why it is open
const ALLOWED = {
  'auth POST /register': 'sign-up',
  'auth POST /login': 'sign-in',
  'auth POST /refresh': 'token refresh (refresh cookie)',
  'auth POST /logout': 'sign-out',
  'auth POST /forgot-password': 'password reset request',
  'auth POST /reset-password': 'password reset with emailed token',
  'forms POST /public/:slug/submit': 'visitor submits a form (validated, honeypot, rate limited)',
  'membership GET /plans': 'public plan list for the website pricing page (read only)',
  'membership GET /join-form/:planSlug': 'public sign-up form definition (read only)',
  'membership POST /signup': 'member sign-up (validated, rate limited, creates a no-permission member account)',
  'membership POST /webhooks/:provider': 'payment gateway webhook (HMAC signature checked, idempotent, rate limited)',
  'membership POST /auth/otp/send': 'mobile OTP login: code sent to the number (rate limited per IP and per number, 5-minute expiry)',
  'membership POST /auth/otp/verify': 'mobile OTP login: verifies the code (5 attempts per code, rate limited), issues the normal login tokens',
  'membership GET /auth/providers': 'enabled social-login buttons for the login page (public label, icon, colour only; read only)',
  'membership GET /auth/oauth/:provider': 'starts the OAuth2/OIDC authorization-code flow (state + PKCE kept in Redis); redirect only',
  'membership GET /auth/oauth/:provider/callback': 'OAuth2/OIDC redirect target: state is single-use and verified; ends in a login redirect',
  'membership POST /auth/oauth/:provider/callback': 'Apple form_post redirect target: same state checks as the GET callback',
  'membership POST /auth/link': 'proves an existing account with its password before linking a social identity (rate limited, signed link token)',
  'integrations GET /webhooks/:driver': 'provider webhook verification (signature checked)',
  'integrations POST /webhooks/:driver': 'provider webhook (signature checked)',
  // optionalAuthenticate: a visitor gets only what is_public allows, an admin gets everything.
  'settings GET /': 'optionalAuthenticate, controller filters by is_public',
  'settings GET /:key': 'optionalAuthenticate, controller 403s non-public keys for visitors',
  'theme-engine GET /tokens': 'optionalAuthenticate, theme tokens the public site needs',
};

// A login check is any middleware named authenticate* (authenticate, authenticateSSE, ...) but not
// optionalAuthenticate (word boundary: that one is listed in ALLOWED with its reason).
const LOGIN = /\bauthenticate\w*\b/;
const isAuthed = (source, statement, at) => {
  if (LOGIN.test(statement)) return true;
  const use = /router\.use\([^;]*\bauthenticate\w*\b/.exec(source);
  return !!use && at > use.index;
};

function openRoutes() {
  const rows = [];
  for (const dir of readdirSync(MODULES, { withFileTypes: true })) {
    const file = join(MODULES, dir.name, 'routes.js');
    if (!dir.isDirectory() || !existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(
      /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]([^;]*?)\);/gs
    )) {
      if (!isAuthed(source, m[0], m.index))
        rows.push({ module: dir.name, method: m[1].toUpperCase(), path: m[2] });
    }
  }
  return rows;
}

describe('public API contract', () => {
  const open = openRoutes();

  it('finds the routes (guards against the scan silently matching nothing)', () => {
    expect(open.length).toBeGreaterThan(20);
  });

  it('every unauthenticated route is a read under /public/*, or explicitly allowed with a reason', () => {
    const offenders = open.filter((r) => {
      const key = `${r.module} ${r.method} ${r.path}`;
      if (key in ALLOWED) return false;
      return !(r.method === 'GET' && r.path.startsWith('/public'));
    });
    expect(offenders.map((r) => `${r.module} ${r.method} ${r.path}`)).toEqual([]);
  });

  it('nothing under /public/* can change data, except the form submit', () => {
    const writes = open.filter((r) => r.path.startsWith('/public') && r.method !== 'GET');
    expect(writes.map((r) => `${r.module} ${r.method} ${r.path}`)).toEqual([
      'forms POST /public/:slug/submit',
    ]);
  });

  it('the allow-list has no stale entries', () => {
    const keys = new Set(open.map((r) => `${r.module} ${r.method} ${r.path}`));
    const stale = Object.keys(ALLOWED).filter(
      (k) => !keys.has(k) && !k.startsWith('settings') && !k.startsWith('theme-engine')
    );
    expect(stale).toEqual([]);
  });
});
