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
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
FAILED=0
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILED=1; }
code() { curl -sk -o /dev/null -m 20 -w '%{http_code}' "$@"; }

# 0. (--fresh-install) The installer, then the website it builds (a new server had pages but no site)
if [ "$FRESH" = 1 ]; then
  I="$BASE/api/install"
  if curl -sk -m 20 "$I/status" | grep -q '"installed":true'; then
    echo "Refusing --fresh-install: this installation is already complete."; exit 2
  fi
  logo=$(mktemp); printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "$logo"
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

  # Frontend > Layouts / Pages / Color Palette / Brands open the website builder (template-engine).
  # Same calls as the admin's StudioStageRedirect: sign in, start a run for the default project, finish INTAKE.
  token=$(curl -sk -m 30 -H 'Content-Type: application/json' -d '{"email":"admin@smoke.test","password":"smokepass1"}' "$BASE/api/auth/login" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d.get("accessToken") or d.get("token") or "")' 2>/dev/null)
  auth=(-H "Authorization: Bearer $token")
  pid=$(curl -sk -m 30 "${auth[@]}" "$BASE/api/projects" | python3 -c 'import json,sys; print([p for p in json.load(sys.stdin)["data"] if p.get("is_default")][0]["id"])' 2>/dev/null)
  run_json=$(printf '{"projectId":"%s"}' "$pid")
  run=$(curl -sk -m 60 "${auth[@]}" -H 'Content-Type: application/json' -d "$run_json" "$BASE/api/template-engine/runs" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])' 2>/dev/null)
  adv=000
  [ -n "$run" ] && adv=$(curl -sk -m 60 -o /dev/null -w '%{http_code}' "${auth[@]}" -H "X-Project-Id: $pid" -X POST "$BASE/api/template-engine/runs/$run/stages/intake/advance")
  case "$adv" in
    2??) pass "website builder opens for the admin (Layouts, Pages)" ;;
    *) fail "website builder did not open (token '${token:+yes}', project '$pid', run '$run', advance $adv; template-engine module enabled?)" ;;
  esac
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
