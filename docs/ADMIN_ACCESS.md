# Admin access — seeded credentials and lockout recovery

Short answer for the most common question: **`Admin@123` no longer works anywhere.** It was
purged in [KDL-307](https://github.com/F9info/kdl-os/pull/65) (`9be0eb9c`). Nothing falls back
to it, and a regression test asserts it never returns
(`backend/tests/regression/seed-credentials.test.js:30`).

## What the admin password is now

Resolved by `backend/prisma/seed-credentials.js` at seed time:

| Situation | Email | Password |
| --- | --- | --- |
| `SEED_ADMIN_PASSWORD` set | `SEED_ADMIN_EMAIL` (default `admin@kdl.com`) | that value — **min 12 chars**, else seeding throws |
| Not set, `NODE_ENV=development` | same | random `base64url` string, **printed once** by the seed |
| Not set, `NODE_ENV=production` | — | seeding **refuses to run**. There is deliberately no default in prod |
| Local docker stack | `admin@kdl.com` | `kdl-dev-seed-password` — pinned in `docker-compose.yml:142` and `docker-compose.e2e.yml:81` |

So: if you brought the stack up with `docker compose up`, try `kdl-dev-seed-password` first.

## Two things that surprise people

**1. Re-running the seed does not reset your password.** `backend/prisma/seed.js:14` skips an
existing admin and logs `Admin user already exists, credentials left untouched`. Setting
`SEED_ADMIN_PASSWORD` and re-seeding therefore does *nothing* to an account that already exists.
Use the reset script below.

**2. A forced password change on first login is expected, not a bug.** The seed sets
`must_change_password: true` ([KDL-283](https://github.com/F9info/kdl-os/pull/61), `858fcf52`).
Until you rotate the password:

- `POST /api/auth/login` succeeds and returns `mustChangePassword: true`
  (`backend/src/modules/auth/controller.js:130`)
- every other endpoint returns **403 `PASSWORD_CHANGE_REQUIRED`**
  (`backend/src/middleware/auth.js:38`) — only the change-password route is exempt

A seeded credential that leaks therefore cannot browse the app. The frontend reads the flag and
redirects you to the change-password screen.

## Recovery — you are locked out

```bash
# host stack — from the monorepo root
pnpm --filter backend db:reset-admin --email admin@kdl.com --password '<12+ chars>'

# or directly, from backend/
cd backend && node scripts/reset-admin-password.js --email admin@kdl.com --password '<12+ chars>'

# docker stack
docker compose exec backend node scripts/reset-admin-password.js \
  --email admin@kdl.com --password '<12+ chars>'
```

Run the direct form **from `backend/`**: it loads env via `dotenv/config`, which reads the `.env`
in the *current working directory*. From the repo root you would pick up the root `.env` instead
of `backend/.env` and may hit the wrong `DATABASE_URL`. The `pnpm --filter` form sets the cwd for you.

What it does (`backend/scripts/reset-admin-password.js`):

- sets the new password hash, `must_change_password: false`, `is_active: true`, `status: ACTIVE`
  — so you land straight in the app rather than back on the forced-change screen
- clears the Redis login-lockout counter for that email
- rejects passwords under 12 characters
- omit `--password` and it generates one and prints it once
  (`NEW_ADMIN_PASSWORD=<pass>` env var also works)
- with `NODE_ENV=production` it **refuses without `--force`**

If the user does not exist at all, it tells you to seed first:
`pnpm --filter backend db:seed`.

## "Account locked" vs "wrong password"

Failed logins trip a progressive per-account lockout in Redis
(`backend/src/modules/auth/service.js:146`), keyed on the lowercased email:

| Failed attempts | Locked for |
| --- | --- |
| 5 | 1 minute |
| 10 | 5 minutes |
| 20 | 30 minutes |

Counters expire on their own; the reset script clears them immediately. If Redis is down the
check fails open — the rate limiter still applies.

## Self-service reset

`POST /api/auth/forgot-password` and `/reset-password` exist and are rate-limited
(`backend/src/modules/auth/routes.js:51-52`), but they deliver the token by email, so they are
only useful when mail delivery is configured. For a local stack the reset script is faster.

## Known inconsistency

Two Playwright specs still hardcode the purged password and will fail at login against a
stack seeded with `kdl-dev-seed-password`:

- `frontend/e2e/command-palette.spec.ts:8`
- `frontend/e2e/kdl440-browser-gate.spec.ts:13`

They should read `SEED_ADMIN_PASSWORD` / an `E2E_*` env var instead. Tracked as a follow-up to
KDL-519 — do not "fix" these by reintroducing `Admin@123` into the seed.

## See also

- [`docs/SETUP.md`](SETUP.md) — §"Admin Login Recovery" has the longer form of the reset
  procedure (pnpm/npm/docker/production variants). This page is the short, findable entry point;
  the content was not missing before KDL-519, only buried mid-way down a setup guide
- [`docs/ENV_REFERENCE.md`](ENV_REFERENCE.md) — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` reference
- [`STATUS.md`](../STATUS.md) — what is built vs pending across the repo
