#!/usr/bin/env bash
# Move the site to another domain (for example from the test <ip>.sslip.io address to gdgvizag.com).
# Point the new domain's DNS A record at this VM first, then on the VM:
#   /opt/gdg/deploy/gcp/set-domain.sh gdgvizag.com
# Updates .env, rewrites the stored image links in the database, rebuilds the website and restarts.
# The site is down for a few minutes. A database backup is taken first (in /opt/gdg/backups).
set -euo pipefail

main() {
  cd "$(dirname "$0")/../.."
  local new="${1:-}"
  new="${new#https://}"; new="${new#http://}"; new="${new%%/*}"
  [ -n "$new" ] || { echo "Usage: $0 <new-domain>" >&2; exit 1; }
  local old
  old="$(grep -E '^SITE_DOMAIN=' .env | cut -d= -f2-)"
  [ -n "$old" ] || { echo "SITE_DOMAIN is missing from .env" >&2; exit 1; }
  if [ "$old" = "$new" ]; then echo "Already on $new"; exit 0; fi
  echo "=== Moving https://$old -> https://$new"

  local ip host_ip
  ip="$(curl -fsS -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)"
  host_ip="$(getent ahostsv4 "$new" | awk 'NR==1{print $1}' || true)"
  if [ -n "$ip" ] && [ "$host_ip" != "$ip" ]; then
    echo "Warning: $new points to '${host_ip:-nothing}', this server is $ip. HTTPS will only work once DNS points here."
  fi

  local C=deploy/gcp/compose.sh old_re
  old_re="$(printf '%s' "$old" | sed 's/[.]/\\./g')"
  mkdir -p backups
  "$C" exec -T postgres pg_dump -U postgres --clean --if-exists --no-owner kdl_db > "backups/before-domain-change.sql"

  "$C" stop backend frontend
  sed "s#https://$old_re#https://$new#g" backups/before-domain-change.sql \
    | "$C" exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d kdl_db >/dev/null
  sed -i -E "/^(SITE_DOMAIN|FRONTEND_URL|BACKEND_URL|APP_PUBLIC_URL|CORS_ORIGIN|LOCAL_STORAGE_BASE_URL)=/ s#$old_re#$new#g" .env

  "$C" build frontend
  "$C" up -d backend frontend caddy
  echo "=== Done. Open https://$new (the certificate can take a minute the first time)."
}
main "$@"
