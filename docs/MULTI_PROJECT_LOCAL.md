# Running several KDL projects on one machine

Every client project built on KDL OS runs its own Docker stack (database, Redis, MinIO, search,
backend, frontend). Several stacks can run side by side on one machine if each one has:

1. **its own Docker project name**,
2. **its own port block**,
3. the **lighter local override** (memory caps, live preview on demand).

`./setup.sh` does all three when it creates `.env` for a new project. This page explains what it
does, and how to fix an older project by hand.

> Local machines only. Servers deploy with explicit `-f` files (`docker-compose.prod.yml`,
> `docker-compose.preview.yml`, `docker-compose.staging.yml`) and their own `.env`, so nothing
> here changes a server. With no `KDL_PORT_*` values set, the compose files resolve exactly as
> before.

## 1. Project name

Two projects with the same Docker project name **share containers and data volumes**: starting
one replaces the other's containers and opens its database. The name comes from, in order:

1. `COMPOSE_PROJECT_NAME` in `.env` (setup.sh writes this, from `--name` or the folder name)
2. `name:` at the top of `docker-compose.yml` (`kdl-os` in this repo)

When you fork KDL OS for a client, setup.sh gives it the folder's name (e.g. `acme-crm`). It
refuses a name that a different folder on this machine already uses. You may also change `name:`
in the client repo's `docker-compose.yml` to the client's name.

Known names on the F9 machine: `kdl-os`, `kdl-starter-kit` (EdMIUM — an older fork that kept the
kit's name; never reuse it), `lexa-portal`.

## 2. Port block

Every published port comes from a `KDL_PORT_*` value in `.env`, with the classic port as default.

| Key | Block 0 (classic) | Block N (N = 1..50) | Block 1 | Block 2 |
|---|---|---|---|---|
| `KDL_PORT_HTTP` (nginx, the app) | 80 | 10000+N×100 | 10100 | 10200 |
| `KDL_PORT_FRONTEND` | 3001 | +1 | 10101 | 10201 |
| `KDL_PORT_BACKEND` | 4000 | +2 | 10102 | 10202 |
| `KDL_PORT_AI` | 5001 | +3 | 10103 | 10203 |
| `KDL_PORT_POSTGRES` | 5433 | +4 | 10104 | 10204 |
| `KDL_PORT_REDIS` | 6380 | +5 | 10105 | 10205 |
| `KDL_PORT_MINIO` | 9002 | +6 | 10106 | 10206 |
| `KDL_PORT_MINIO_CONSOLE` | 9003 | +7 | 10107 | 10207 |
| `KDL_PORT_MEILI` | 7700 | +8 | 10108 | 10208 |
| `KDL_PORT_CHROMA` | 8000 | +9 | 10109 | 10209 |
| `KDL_PORT_SMTP` (MailHog) | 1025 | +10 | 10110 | 10210 |
| `KDL_PORT_MAIL_UI` (MailHog) | 8025 | +11 | 10111 | 10211 |
| `KDL_PORT_CLAMAV` | 3310 | +12 | 10112 | 10212 |

setup.sh picks the first block whose 13 ports are all free: not listening now, and not claimed by
any container (running or stopped) of any project. Force one with `./setup.sh --block 3`.
The app is then at `http://localhost:<KDL_PORT_HTTP>` (block 0: `http://localhost`).

**Changing the MinIO port needs a frontend rebuild** (`docker compose build frontend`): the
browser's allowed image host (`NEXT_PUBLIC_IMAGE_HOSTS`) is baked in at build time.

Developer mode (`docker-compose.infra.yml`, Path B) follows the same Postgres / Redis / Meili /
Chroma values; its MinIO stays on 9000/9001, so run only one Path B project at a time.

## 3. Lighter local override

setup.sh copies `docker-compose.override.example.yml` to `docker-compose.override.yml`
(git-ignored; Compose loads it automatically, on this machine only):

- **site-preview** (the "Frontend view" live preview, ~190 MB) starts only when asked:
  `docker compose --profile preview up -d site-preview` / `docker compose stop site-preview`.
- **Memory caps** on every service, well above normal use, so one runaway service cannot starve
  the other projects.

## Machine settings

- **Docker Desktop memory: 12 GB** (Settings → Resources) for 4–5 projects. One project uses
  roughly 0.5–1 GB idle; a frontend build needs 2–3 GB more for a few minutes.
- **Build one project at a time.**
- Stop projects you are not using: `docker compose stop` (data is kept; `docker compose start`).
- Now and then: `docker builder prune` (frees build cache; the next build is slower).

## Why there is no shared database / MinIO across projects

Checked 2026-11-20: every fork uses the same MinIO bucket (`kdl-media`, also stored per row in
`Media.bucket`), the same MeiliSearch index (`media`) and the same Chroma collections, all fixed in
code. One shared MinIO / Meili / Chroma would mix the projects' files and search results. Sharing
only Postgres / Redis / MailHog saves about 0.1 GB per project — not worth the coupling.

## Fixing an existing project by hand

In that project's (git-ignored) `.env` add a unique `COMPOSE_PROJECT_NAME` only if its
`docker-compose.yml` `name:` clashes with another project — **changing the name of a project that
already has data makes Docker start a new, empty stack** (the old volumes stay, under the old
name). Add `KDL_PORT_*` values only if its compose file reads them. Copy the override template if
you want the caps.
