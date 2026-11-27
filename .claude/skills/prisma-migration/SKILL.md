---
name: prisma-migration
description: Use when changing backend/prisma/schema.prisma or creating, applying or reverting a Prisma migration. Do not use for plain queries.
---

# Prisma migration

```bash
cd backend
npm run db:migrate      # prisma migrate dev  (creates and applies, local only)
npm run db:seed         # prisma/seed.js
npm run db:studio
```

- One concern per migration. Name it for what it does.
- Add a default or backfill before making a column NOT NULL.
- Never edit a migration that has been merged. Add a new one.
- Local DB is Postgres 15 in Docker (host port 10104 in this stack). Do not run `migrate reset` or touch volumes without the owner's go-ahead: it deletes data.
- Finish with `db-migration-reviewer`, then rebuild the backend image (`docker-rebuild` skill) so the container runs the new migration.
