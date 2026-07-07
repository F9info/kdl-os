# Notification System — KDL Starter Kit
# Module 5 Design Document (Complete application notification management)

**Author:** Claude (Cowork) — approved by Prasanna (web@f9tech.com)
**Date:** 2026-07-07
**Status:** FINAL v1.0 — Implementation-ready.
**Mode:** 24/7 unattended — Auto-Approval Protocol applies (`.agents/USER_MANAGEMENT_ARCH.md`).
**Type:** New plugin module, slug `notifications` (non-core).
**Depends on:** Module Plugin System (done). SOFT dependency on `integrations` for external channels (manifest `dependsOn: []` — in-app works standalone; email/SMS/WhatsApp channels activate only when integrations is ENABLED). Build AFTER INTEGRATIONS_ARCH.

---

## Read Scope (TOKEN RULE — read ONLY your step's sections)

| Step | Sections |
|---|---|
| 1 | Prisma Schema |
| 2 | Dispatch Service, Rules |
| 3 | API Endpoints (user + admin) |
| 4 | Real-time Delivery |
| 5 | Frontend |
| 6 (review) | Whole doc |
| 7 (E2E) | Implementation Order Step 7 row |
| 8 (docs) | Overview + endpoint table |

---

## Overview

Complete notification management: **in-app notification center** (bell, unread count, real-time), **templates** with variables and per-channel bodies, **user preferences** (opt in/out per category × channel), **broadcasts** (to a role or all users), and external delivery (EMAIL/SMS/WHATSAPP) through the integrations module's `dispatchMessage`. Any module triggers notifications through ONE function: `notify()`.

Scaffold with `npm run module:create -- --slug=notifications --name="Notifications"` + New Module Checklist.

---

## Prisma Schema

**File:** `backend/prisma/schema/notifications.prisma`

```prisma
enum NotificationChannel { IN_APP EMAIL SMS WHATSAPP }

model NotificationCategory {
  id          String  @id @default(cuid())
  slug        String  @unique       // "system", "security", "billing", "activity"
  name        String
  description String?
  is_system   Boolean @default(false)   // seeded categories not deletable
  created_at  DateTime @default(now())

  templates   NotificationTemplate[]
  preferences NotificationPreference[]

  @@map("notification_categories")
}

model NotificationTemplate {
  id          String  @id @default(cuid())
  slug        String  @unique       // "user.welcome", "security.password-changed"
  category_id String
  name        String
  variables   Json                   // ["user_name", "reset_link"] — documented placeholders
  in_app_body String?                // {{var}} placeholders; null = channel unavailable
  email_subject String?
  email_body  String?                // HTML allowed (sanitized on render)
  sms_body    String?
  whatsapp_body String?
  is_active   Boolean @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  category NotificationCategory @relation(fields: [category_id], references: [id])

  @@map("notification_templates")
}

model Notification {
  id         String   @id @default(cuid())
  user_id    String
  category_slug String
  title      String
  body       String
  data       Json?                   // {url: "/admin/users/x", entity: ...} for click-through
  read_at    DateTime?
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, read_at])
  @@index([created_at])
  @@map("notifications")
}

model NotificationPreference {
  user_id     String
  category_id String
  channel     NotificationChannel
  enabled     Boolean @default(true)

  user     User                 @relation(fields: [user_id], references: [id], onDelete: Cascade)
  category NotificationCategory @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@id([user_id, category_id, channel])
  @@map("notification_preferences")
}
```

Seed (module seed.js): categories `system`, `security`, `account`, `activity` (is_system) + starter templates: `user.welcome`, `security.password-changed`, `security.new-login`, `system.broadcast`.

---

## Dispatch Service

`service.js` exports the single entry point:

```js
notify({
  to: { user_ids?[] , role_slug?, all?: true },   // exactly one
  template: 'security.password-changed',           // OR inline: {title, body}
  data: { user_name: 'Prasanna', url: '/...' },    // variable values + click-through
  channels: ['IN_APP', 'EMAIL'],                   // default ['IN_APP']
  actor_id?,                                       // for activity logging
})
```

Flow per recipient batch (resolve role/all → user ids, chunk 500):
1. Render template per channel (`{{var}}` interpolation; missing variable → log + literal blank, never crash; email HTML sanitized).
2. Filter by NotificationPreference (default enabled when no row). `security` category ignores opt-out for IN_APP (always delivered).
3. IN_APP → bulk insert Notification rows → publish per-user Redis event (see Real-time).
4. EMAIL/SMS/WHATSAPP → integrations `dispatchMessage(..., source: 'notifications')` via **dynamic import wrapped in try/catch**: integrations disabled/absent → skip channel, count skipped, log once (`writeActivityAsync`), never fail the notify() call. Recipient contact = user email / `phone` (add `phone String?` to User if absent — check first; if adding, own migration).
5. Heavy sends (role/all) run through BullMQ queue `notifications.queue.js` — `notify()` returns immediately with a batch id.

Rules: worker instantiated in index.js + closed on shutdown; every admin mutation → writeActivity; retention — daily BullMQ repeatable job deletes read notifications older than `notifications.retention_days` (app_settings, default 90).

---

## API Endpoints (all `moduleGate('notifications')`; manifest registers `notifications` permission module)

**User-facing (authenticate only — own data):**

| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications` | own list, paginated, `?unread=true` filter |
| GET | `/api/notifications/unread-count` | cheap; polled fallback |
| PATCH | `/api/notifications/:id/read` | own only (404 otherwise) |
| POST | `/api/notifications/read-all` | |
| DELETE | `/api/notifications/:id` | own only |
| GET | `/api/notifications/stream` | SSE (see Real-time) |
| GET/PUT | `/api/notifications/preferences` | own matrix: category × channel toggles |

**Admin (requirePermission('notifications', ...)):**

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/notifications/templates[...]` | view/add/edit/delete | delete 409 if is_system category template referenced by code seeds |
| POST | `/api/notifications/templates/:id/preview` | notifications:view | render with sample data, per channel |
| POST | `/api/notifications/broadcast` | notifications:publish | `{to: role_slug|all, template|inline, channels}` → queued batch; activity-logged with recipient count |
| GET/POST/PATCH | `/api/notifications/categories` | view/add/edit | is_system not deletable |

---

## Real-time Delivery

**SSE (Server-Sent Events)** — no websocket infra needed, works through nginx with `proxy_buffering off` for this route:

- `GET /api/notifications/stream` (authenticate): holds connection, subscribes to Redis pub/sub `notif:user:{id}`; on message → SSE event `{id, title, body, data, created_at}`. Heartbeat comment every 25s. Cap 3 concurrent streams per user (close oldest).
- Publisher: dispatch step 3 → `redis.publish('notif:user:{id}', payload)`. Use a DUPLICATED Redis connection for subscribe mode (ioredis requirement) — never the shared client.
- Frontend falls back to 30s `unread-count` polling when EventSource errors (SSE optional, not a gate blocker for older setups).
- nginx: add `/api/notifications/stream` location with buffering off (infra change — include in Step 4).

---

## Frontend

- **Bell in TopBar** (core layout touch — smallest possible diff, rendered only when module enabled via `useModules()`): unread badge, dropdown with latest 10, mark-read on click, click-through via `data.url`, live update from `useNotificationStream()` hook (EventSource + TanStack Query cache update + toast for new arrivals).
- **`app/admin/notifications/page.tsx`:** full list (read/unread filter, mark all, delete) — ModuleGuard wrapped.
- **`app/admin/notifications/preferences/page.tsx`:** category × channel toggle matrix (own).
- **Admin pages:** templates (DataTable + editor dialog with per-channel bodies, variable chips, preview tab), broadcast composer (audience select: all/role → template or inline → channel checkboxes → confirm with recipient count).
- Types → `types/notifications.types.ts`.

---

## Implementation Order

| Step | Task | Agent | Gate |
|---|---|---|---|
| 1 | Scaffold + schema + seed (categories/templates) (+ User.phone if absent) | Backend Architect → Coder | prisma validate + migrate clean |
| 2 | Dispatch service + queue/worker + template renderer + preference filtering + retention job | Backend Coder | vitest: render/interpolation, preference matrix, security-category override, integrations-disabled skip path, chunking |
| 3 | User + admin endpoints | Backend Coder | vitest: own-data isolation (404 on others' rows), broadcast queues, preview |
| 4 | SSE stream + Redis pub/sub + nginx config | Backend Coder | vitest: publish on insert; manual curl SSE check documented in HANDOFF |
| 5 | Frontend: bell + stream hook + center + preferences + admin pages | Frontend Coder | tsc exit 0; RTL: bell badge updates on stream event |
| 6 | Code review (Maker ≠ Grader) | Code Reviewer | PASS, zero CRITICAL/HIGH |
| 7 | E2E: enable module → broadcast to all → bell badge appears for second user (non-super-admin) → mark read → preferences opt-out suppresses next broadcast → with integrations enabled + mailhog: EMAIL channel logs SENT | Code Reviewer runs, Gate Verifier verifies | Playwright exit 0 (rebuilt images) |
| 8 | Docs: API_REFERENCE, SETUP (nginx SSE note) | Documentation | docs match code |

---

## Known Risks

- **SSE through the stack:** nginx buffering and docker networking are the usual failure points — Step 4 must verify through the nginx container, not just direct backend port.
- Redis subscriber connections leak if stream close handlers are missed — test disconnect cleanup (vitest with mock socket close).
- Broadcast to all with external channels = real cost — broadcast endpoint requires `notifications:publish` (not just edit) and logs recipient count; E2E never sends external channels except mailhog.
- The bell touches core TopBar — keep it a self-contained component behind `useModules()` so notifications disabled = zero footprint (checklist rule: works when module disabled).
- Template HTML injection: sanitize email_body render output AND in_app body is plain text only (React escapes by default — never dangerouslySetInnerHTML).
