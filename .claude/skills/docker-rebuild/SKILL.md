---
name: docker-rebuild
description: Use when a code change must show up in the local stack (localhost:10100 nginx, 10101 frontend, 10102 backend) or when the running app behaves like old code. Backend and frontend run baked Docker images with no source mount, so edits do nothing until rebuilt. Do not use for unit tests, which run from source.
---

# Rebuild local containers

Frontend and backend images contain the code at build time. Verified 2026-11-27: editing source did not change the running app until rebuild.

```bash
cd /Users/f9developer/Development/kdl-f9tech/f9tech-crm
docker compose build backend frontend      # only the service(s) you changed
docker compose up -d backend frontend
```

## Verify
- Backend picked it up: `docker exec f9tech-crm-backend-1 grep -c "<new symbol>" /app/src/<path>` returns 1 or more.
- Frontend: `curl -s -o /dev/null -w "%{http_code}" http://localhost:10101/` returns 200, then hard-refresh the browser.
- Wait for `Healthy` on the backend before testing.

Rebuild only what changed. Never run `docker compose down -v` (it deletes the database volume).
