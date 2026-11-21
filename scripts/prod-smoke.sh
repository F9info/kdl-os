#!/usr/bin/env bash
# Production smoke check: run against a stack started with
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# from the repo folder. Checks the things that broke on the first real server (2026-11-20/21) and that a
# Mac never shows: the installer route, / before a website exists, the API rate limit, the backend
# writing the generated-site folder on Linux, and uploaded files loading through https://<host>/kdl-media/.
#
#   scripts/prod-smoke.sh [https://host[:port]]                    default https://localhost
#   scripts/prod-smoke.sh --fresh-install [https://host[:port]]    CI: run the installer first (see below)
#
# Safe on a live server: it reads, writes one test file to MinIO and one to the sites folder, and deletes both.
# --fresh-install runs the first-run installer through its API (Admin + Frontend, sample content) and waits
# for the public website; it refuses when the installation is already complete, so it never touches a real site.
# Exit code 0 = all checks passed. Uses -k (self-signed certificates are fine) and needs curl and python3.
set -uo pipefail
cd "$(dirname "$0")/.."

FRESH=0
[ "${1:-}" = --fresh-install ] && { FRESH=1; shift; }
BASE="${1:-https://localhost}"
# SMOKE_COMPOSE_FILES: other compose files, e.g. "-f docker-compose.yml" to check a local development stack.
read -r -a _files <<< "${SMOKE_COMPOSE_FILES:--f docker-compose.yml -f docker-compose.prod.yml}"
COMPOSE=(docker compose "${_files[@]}")
FAILED=0
# A real 64x64 PNG with four colour blocks: the Studio reads the palette from it (a 1x1 or broken PNG fails).
base64_png() { printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAZUlEQVR42u3PIREAIRAAQDyGBDgEGYhDEorQg0yv35MBcW5ntsCmNr9Q5axQSUBAQEBAQEBAQEBAQEBAQEBAQEBAQEDgOfDvHKr2EUpAQEBAQEBAQEBAQEBAQEBAQEBAQEBA4NkFU5t1HunMUhYAAAAASUVORK5CYII=' | { base64 -d 2>/dev/null || base64 -D; }; }
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
code() { curl -sk -o /dev/null -m 20 -w '%{http_code}' "$@"; }

# 0. (--fresh-install) The installer, then the website it builds (a new server had pages but no site)
if [ "$FRESH" = 1 ]; then
  I="$BASE/api/install"
  if curl -sk -m 20 "$I/status" | grep -q '"installed":true'; then
    echo "Refusing --fresh-install: this installation is already complete."; exit 2
  fi
  logo=$(mktemp); base64_png > "$logo"
  lp=$(curl -sk -m 60 -F "file=@$logo;type=image/png" "$I/logo" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["path"])' 2>/dev/null); rm -f "$logo"
  put() { curl -sk -m 600 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' "$@"; }
  ok=1
  [ -n "$lp" ] || ok=0
  company_json=$(printf '{"name":"Smoke Co","phone":"","email":"","logo_path":"%s"}' "$lp") # a variable: bash 3.2 mis-parses nested quotes
  [ "$(put -X PUT "$I/company" -d "$company_json")" = 200 ] || ok=0
  [ "$(put -X PUT "$I/admin" -d '{"name":"Smoke Admin","email":"admin@smoke.test","password":"smokepass1","confirm_password":"smokepass1"}')" = 200 ] || ok=0
  [ "$(put -X PUT "$I/app-type" -d '{"app_type":"admin-frontend"}')" = 200 ] || ok=0
  [ "$(put -X POST "$I/core")" = 200 ] || ok=0
  [ "$(put -X PUT "$I/modules" -d '{"modules":[],"demo":true}')" = 200 ] || ok=0
  [ "$(put -X POST "$I/complete")" = 200 ] || ok=0
  [ "$ok" = 1 ] && pass "installer completed (Admin + Frontend, sample content)" || fail "installer API steps failed"
  c=000
  for _ in $(seq 1 60); do c=$(code "$BASE/"); [ "$c" = 200 ] && break; sleep 10; done
  [ "$c" = 200 ] && pass "public website at / is up after install (first site build)" || fail "/ is $c 10 minutes after install, expected 200 (first site build? site-preview logs)"

  # The installer completes the Studio in the background before the first site build (studio-defaults.js):
  # Frontend > Brands / Color Palette / Navigation / Layouts / Pages need it. Sign in as the admin and check
  # what those screens read, the way StudioStageRedirect does (reuse the run, never start a second one).
  token=$(curl -sk -m 30 -H 'Content-Type: application/json' -d '{"email":"admin@smoke.test","password":"smokepass1"}' "$BASE/api/auth/login" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d.get("accessToken") or d.get("token") or "")' 2>/dev/null)
  auth=(-H "Authorization: Bearer $token")
  pid=$(curl -sk -m 30 "${auth[@]}" "$BASE/api/projects" | python3 -c 'import json,sys; print([p for p in json.load(sys.stdin)["data"] if p.get("is_default")][0]["id"])' 2>/dev/null)
  api() { curl -sk -m 60 "${auth[@]}" -H "X-Project-Id: $pid" "$@"; }
  website=""
  for _ in $(seq 1 30); do
    website=$(api "$BASE/api/template-engine/runs?projectId=$pid" | python3 -c '
import json,sys
runs=json.load(sys.stdin)["data"]
print(next((s["status"] for s in (runs[0]["stages"] if runs else []) if s["stage"]=="WEBSITE"), "none"))' 2>/dev/null)
    [ "$website" = DONE ] && break; sleep 10
  done
  [ "$website" = DONE ] && pass "Studio completed by the installer (run reached Website)" || fail "Studio run Website stage is '$website' (backend logs: 'studio defaults')"
  kit=$(api "$BASE/api/brand-kit/$pid" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["status"], len(((d.get("palette") or {}).get("colors")) or []))' 2>/dev/null)
  case "$kit" in approved\ [1-9]*) pass "brand kit approved with a palette from the logo ($kit colours)" ;; *) fail "brand kit is '$kit', expected approved with colours (Color Palette)" ;; esac
  layout=$(api "$BASE/api/projects/$pid/layout" | python3 -c 'import json,sys; print("yes" if json.load(sys.stdin).get("data") else "no")' 2>/dev/null)
  [ "$layout" = yes ] && pass "header/footer layout saved (Layouts)" || fail "no site layout saved (Layouts)"
  links=$(api "$BASE/api/menus" | python3 -c 'import json,sys; print(sum(len(m.get("items") or []) for m in json.load(sys.stdin)["data"]["items"] if m.get("key")=="header"))' 2>/dev/null)
  [ "${links:-0}" -gt 0 ] 2>/dev/null && pass "header menu has $links links (Navigation)" || fail "header menu has no links (Navigation)"
  pages=$(api "$BASE/api/page-builder?limit=100" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"]["items"]))' 2>/dev/null)
  [ "${pages:-0}" -gt 0 ] 2>/dev/null && pass "$pages website pages (Pages)" || fail "no website pages (Pages)"
  run=$(api "$BASE/api/template-engine/runs?projectId=$pid" | python3 -c 'import json,sys; r=json.load(sys.stdin)["data"]; print(r[0]["id"] if r else "")' 2>/dev/null)
  runs_count=$(api "$BASE/api/template-engine/runs?projectId=$pid" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"]))' 2>/dev/null)
  [ -n "$run" ] && [ "$runs_count" = 1 ] && pass "website builder opens for the admin (Brands, Color Palette, Layouts, Pages)" \
    || fail "website builder: run '$run', $runs_count runs (expected exactly 1)"

  # Media: an uploaded image gets a URL once the virus scan passes (production requires a CLEAN scan).
  img=$(mktemp); base64_png > "$img"
  mid=$(api -F "file=@$img;type=image/png;filename=smoke.png" "$BASE/api/media/upload/single" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["media"][0]["id"])' 2>/dev/null); rm -f "$img"
  murl=""
  for _ in $(seq 1 24); do
    murl=$(api "$BASE/api/media/$mid" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; d=d.get("media", d); print(d.get("url") or "")' 2>/dev/null)
    [ -n "$murl" ] && break; sleep 5
  done
  [ -n "$murl" ] && [ "$(code "$murl")" = 200 ] && pass "Media upload is scanned and loads (${murl%%\?*})" \
    || fail "uploaded media '$mid' has no working URL after 2 minutes (virus scanner running? CLAMAV_HOST)"
fi

# 1. Backend through nginx over https
[ "$(code "$BASE/health")" = 200 ] && pass "/health 200" || fail "/health is $(code "$BASE/health"), expected 200"

# 2. Admin app routes reach the frontend (b86b90a: /install fell through to the site and gave 502)
for p in /install /login; do
  c=$(code "$BASE$p")
  [ "$c" = 200 ] && pass "$p 200" || fail "$p is $c, expected 200 (admin app route in nginx.prod.conf?)"
done

# 3. / never answers 502: the site, or a redirect to /login while no website exists
c=$(code "$BASE/")
case "$c" in
  200) pass "/ 200 (public website is up)" ;;
  302)
    loc=$(curl -sk -o /dev/null -m 20 -D - "$BASE/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
    [ "$loc" = /login ] && pass "/ 302 -> /login (no website yet)" || fail "/ redirects to '$loc', expected /login"
    ;;
  *) fail "/ is $c, expected 200 or 302 -> /login" ;;
esac

# 4. The API allows normal use (production limit was 100 per 15 min per address)
limited=0
for _ in $(seq 1 150); do [ "$(code "$BASE/api/v1/app-config")" = 429 ] && limited=$((limited + 1)); done
[ "$limited" = 0 ] && pass "150 API requests, no 429" || fail "$limited of 150 API requests got 429 (API_RATE_LIMIT?)"

# 5. Backend and site-preview share uid 100 and the backend can write the generated-site folder
u_backend=$("${COMPOSE[@]}" exec -T backend id -u 2>/dev/null | tr -d '\r')
u_site=$("${COMPOSE[@]}" exec -T site-preview id -u 2>/dev/null | tr -d '\r')
[ "$u_backend" = 100 ] && [ "$u_site" = 100 ] && pass "backend and site-preview run as uid 100" \
  || fail "backend uid '$u_backend', site-preview uid '$u_site', expected 100 and 100"
if "${COMPOSE[@]}" exec -T backend sh -c 'f=/app/generated-sites/.smoke-$$ && touch "$f" && rm "$f"' 2>/dev/null; then
  pass "backend can write /app/generated-sites"
else
  fail "backend cannot write /app/generated-sites (site-perms service? folder owner?)"
fi

# 6. An uploaded file loads in the browser through https://<host>/kdl-media/ (was signed for localhost:9002)
url=$("${COMPOSE[@]}" exec -T backend node --input-type=module -e "
  const { minioDriver: d } = await import('./src/shared/services/storage/drivers/minio.driver.js');
  await d.ensureBucket();
  const b = Buffer.from('kdl-smoke');
  await d.put({ buffer: b, size: b.length, mimetype: 'text/plain' }, 'smoke/check.txt');
  console.log(await d.presign('smoke/check.txt', 300));
" 2>/dev/null | tail -1 | tr -d '\r')
case "$url" in
  https://*/kdl-media/*)
    body=$(curl -sk -m 20 "$url")
    [ "$body" = kdl-smoke ] && pass "uploaded file loads via ${url%%\?*}" || fail "signed file URL did not return the file (got '${body:0:80}')"
    ;;
  *) fail "file URL is '${url%%\?*}', expected https://<domain>/kdl-media/... (MINIO_PUBLIC_ENDPOINT in .env?)" ;;
esac
"${COMPOSE[@]}" exec -T backend node --input-type=module -e "
  const { minioDriver: d } = await import('./src/shared/services/storage/drivers/minio.driver.js');
  await d.delete('smoke/check.txt');
" >/dev/null 2>&1 || true

# 7. The bucket is not open: no listing, no uploads from outside
c=$(code "$BASE/kdl-media/"); [ "$c" = 403 ] && pass "bucket listing blocked (403)" || fail "GET /kdl-media/ is $c, expected 403"
c=$(code -X PUT --data x "$BASE/kdl-media/smoke/x.txt"); [ "$c" = 403 ] && pass "upload from outside blocked (403)" || fail "PUT /kdl-media/... is $c, expected 403"

echo
if [ "$FAILED" = 0 ]; then echo "All production smoke checks passed."; else echo "Some production smoke checks FAILED."; fi
exit "$FAILED"
