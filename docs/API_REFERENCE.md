# API Reference — KDL Starter Kit

All endpoints return a consistent JSON envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "...", "errors": [...] }
```

**Auth:** All protected routes require `Authorization: Bearer <accessToken>`.

---

## Backend — `http://localhost:4000`

### Health

#### `GET /health`

No auth required.

**Response 200:**
```json
{ "success": true, "data": { "status": "ok", "uptime": 42.5 } }
```

---

### Auth — `/api/auth`

#### `POST /api/auth/register`

Register a new user. Default role: `USER`.

**Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "MinLength8!"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "USER" },
    "accessToken": "eyJ..."
  }
}
```

The refresh token is set as an httpOnly cookie (`kdl-refresh-token`).

---

#### `POST /api/auth/login`

**Body:**
```json
{ "email": "admin@kdl.com", "password": "Admin@123" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Admin",
      "email": "admin@kdl.com",
      "role": "SUPER_ADMIN",
      "status": "ACTIVE",
      "roles": ["super-admin"]
    },
    "accessToken": "eyJ..."
  }
}
```

Refresh token set as httpOnly cookie. `roles` is an array of role slugs from `user_roles`. Suspended or soft-deleted users receive `401 Invalid credentials`.

---

#### `POST /api/auth/refresh`

Rotates the refresh token. Old token is revoked; a new one is issued as a cookie.

No body required — reads the `kdl-refresh-token` httpOnly cookie.

**Response 200:**
```json
{ "success": true, "data": { "accessToken": "eyJ..." } }
```

---

#### `POST /api/auth/logout`

Revokes the current refresh token.

**Response 200:**
```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

---

#### `GET /api/auth/me/permissions`

Required permission: authenticated (any active user).

Returns the caller's effective RBAC permission set and role slugs. Used by the frontend `usePermissions()` hook to gate UI elements. Super Admin receives `bypass: true` — all access without enumerating individual permissions.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "permissions": ["users:view", "users:add", "roles:view"],
    "roles": ["admin"],
    "bypass": false
  }
}
```

For Super Admin:
```json
{
  "success": true,
  "data": {
    "permissions": [],
    "roles": ["super-admin"],
    "bypass": true
  }
}
```

---

### Users — `/api/users`

Requires `users:view` / `users:add` / `users:edit` / `users:delete` permission. Super Admin bypasses all checks.

#### `GET /api/users`

List users. Excludes soft-deleted users.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | `ACTIVE`\|`SUSPENDED`\|`PENDING` | Filter by UserStatus |
| `role` | string | Filter by role slug (e.g. `admin`) |
| `is_active` | `true`\|`false` | Filter by is_active flag |
| `search` | string | Case-insensitive match on name or email |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "...",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "role": "USER",
        "is_active": true,
        "status": "ACTIVE",
        "avatar_media_id": null,
        "last_login_at": null,
        "deleted_at": null,
        "created_at": "2026-07-01T10:00:00.000Z",
        "updated_at": "2026-07-01T10:00:00.000Z",
        "roles": [
          { "id": "...", "name": "Admin", "slug": "admin" }
        ]
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
  }
}
```

---

#### `GET /api/users/:id`

Required permission: `users:view`

**Response 200:** Single user object (same shape as list item, no `password_hash`). `404` if not found or soft-deleted.

---

#### `POST /api/users`

Required permission: `users:add`

**Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "MinLength8!",
  "status": "ACTIVE",
  "role_ids": ["role_id_1"]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | 2–100 chars |
| `email` | Yes | Normalized to lowercase |
| `password` | Yes | Min 8 chars |
| `status` | No | `ACTIVE` (default) \| `SUSPENDED` \| `PENDING` |
| `role_ids` | No | Array of RbacRole IDs. Defaults to system `user` role. Non-super-admin cannot assign `super-admin` role (→ `403`). |

**Response 201:** `{ "user": { ... } }` — same shape as GET.

**Error conditions:**
- `409` — email already in use
- `403` — non-super-admin attempting to assign `super-admin` role

---

#### `PATCH /api/users/:id`

Required permission: `users:edit`

**Body** (all optional):
```json
{
  "name": "New Name",
  "email": "new@email.com",
  "status": "SUSPENDED",
  "role_ids": ["role_id_1", "role_id_2"],
  "avatar_media_id": "media_id_or_null"
}
```

`role_ids` replaces all current role assignments atomically. Non-super-admin callers cannot modify Super Admin users or assign the `super-admin` role (→ `403`).

**Response 200:** `{ "user": { ... } }`

**Error conditions:**
- `403` — non-super-admin attempting to modify a super-admin user or assign the super-admin role
- `404` — user not found
- `409` — email already in use

---

#### `DELETE /api/users/:id`

Required permission: `users:delete`

Soft deletes (sets `deleted_at` + `is_active: false`). A soft-deleted user cannot log in.

**Error conditions:**
- `409` — attempting to delete own account ("You can not delete your own account")
- `403` — non-super-admin attempting to delete a super-admin user
- `404` — user not found

**Response 200:** `{ "user": { ..., "deleted_at": "2026-07-06T..." } }`

---

#### `POST /api/users/:id/reset-password`

Required permission: `users:edit`

Sets a new password for the target user. All existing refresh tokens for that user are revoked (forcing re-login on all devices). Activity-logged.

**Body:**
```json
{ "password": "NewPassword8!" }
```

**Error conditions:**
- `403` — non-super-admin attempting to reset a super-admin's password
- `404` — user not found

**Response 200:** `{ "user": { ... } }`

---

#### `PUT /api/users/:id/overrides`

Required permission: `permissions:edit`

Replaces the user's entire per-permission override set atomically. An empty `overrides` array clears all overrides.

Override resolution: `(union of role permissions) ∪ GRANT overrides − DENY overrides`. DENY wins.

**Body:**
```json
{
  "overrides": [
    { "permission_id": "perm_id_1", "mode": "GRANT" },
    { "permission_id": "perm_id_2", "mode": "DENY" }
  ]
}
```

**Error conditions:**
- `404` — user not found
- `422` — one or more `permission_id` values are invalid

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "...",
      "roles": [...],
      "permission_overrides": [
        { "permission_id": "...", "module_id": "...", "action": "view", "mode": "GRANT" }
      ]
    }
  }
}
```

---

### Roles — `/api/roles`

All role endpoints require authentication. Super Admin bypasses permission checks.

#### `GET /api/roles`

Required permission: `roles:view`

**Query params:** `page`, `limit`, `search` (name or slug, case-insensitive)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "id": "...",
        "name": "Content Editor",
        "slug": "content-editor",
        "description": "...",
        "is_system": false,
        "created_at": "...",
        "updated_at": "...",
        "user_count": 3,
        "permission_count": 10
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
  }
}
```

---

#### `GET /api/roles/:id`

Required permission: `roles:view`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "role": {
      "id": "...",
      "name": "Content Editor",
      "slug": "content-editor",
      "description": null,
      "is_system": false,
      "created_at": "...",
      "updated_at": "...",
      "user_count": 3,
      "permissions": [ ... ],
      "permission_matrix": {
        "users:view": "perm_id_1",
        "roles:view": "perm_id_2"
      }
    }
  }
}
```

`permission_matrix` maps `"module:action"` to the permission ID. `404` if not found.

---

#### `POST /api/roles`

Required permission: `roles:add`

**Body:**
```json
{
  "name": "Content Editor",
  "description": "Can view and edit content",
  "permission_ids": ["perm_id_1", "perm_id_2"]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | 2–100 chars. Slug auto-derived (`"Content Editor"` → `"content-editor"`). |
| `description` | No | Max 255 chars |
| `permission_ids` | No | Array of Permission IDs. Defaults to `[]`. |

**Response 201:** `{ "role": { ... } }` — same shape as GET by ID.

**Error conditions:**
- `409` — role with that name or slug already exists
- `422` — one or more `permission_ids` are invalid

---

#### `PATCH /api/roles/:id`

Required permission: `roles:edit`

**Body** (all optional):
```json
{
  "name": "Senior Editor",
  "description": "Updated description",
  "permission_ids": ["perm_id_1", "perm_id_3"]
}
```

`permission_ids` replaces all current permissions atomically (full sync). System roles (`is_system: true`) cannot be renamed — description stays editable.

**Error conditions:**
- `404` — role not found
- `409` — name/slug conflict, or attempting to rename a system role
- `422` — invalid `permission_ids`

**Response 200:** `{ "role": { ... } }`

---

#### `DELETE /api/roles/:id`

Required permission: `roles:delete`

**Error conditions:**
- `404` — role not found
- `409` — system role (`is_system: true`): "Cannot delete a system role"
- `409` — users assigned: "Unable to delete: users are assigned to this role"

**Response 200:**
```json
{ "success": true, "data": { "message": "Role deleted" } }
```

---

### Permissions — `/api/permissions`

All permission endpoints require authentication. Super Admin bypasses permission checks.

#### `GET /api/permissions/matrix`

Required permission: `permissions:view`

Returns all permission modules with their 5-action permission IDs. Used to populate the role edit checkbox matrix.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "matrix": [
      {
        "id": "...",
        "name": "users",
        "label": "Users",
        "is_system": true,
        "sort_order": 0,
        "created_at": "...",
        "actions": {
          "view": "perm_id_1",
          "add": "perm_id_2",
          "edit": "perm_id_3",
          "delete": "perm_id_4",
          "publish": "perm_id_5"
        }
      }
    ]
  }
}
```

System modules appear first, then sorted by `sort_order` ascending.

---

#### `POST /api/permissions/modules`

Required permission: `permissions:add`

Creates a new permission module and atomically creates its 5 action permissions (`view`, `add`, `edit`, `delete`, `publish`).

**Body:**
```json
{
  "name": "blog-posts",
  "label": "Blog Posts",
  "sort_order": 10
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | 2–100 chars. Normalized to lowercase-hyphen (`"Blog Posts"` → `"blog-posts"`). Must be unique. |
| `label` | Yes | 2–100 chars. Display name. |
| `sort_order` | No | Integer, default `0`. |

**Error conditions:**
- `409` — module with that name already exists

**Response 201:**
```json
{
  "success": true,
  "data": {
    "module": { "id": "...", "name": "blog-posts", "label": "Blog Posts", "is_system": false, "sort_order": 10, "created_at": "..." },
    "permissions": [
      { "id": "perm_id_1", "module_id": "...", "action": "view", "created_at": "..." },
      { "id": "perm_id_2", "module_id": "...", "action": "add", "created_at": "..." },
      { "id": "perm_id_3", "module_id": "...", "action": "edit", "created_at": "..." },
      { "id": "perm_id_4", "module_id": "...", "action": "delete", "created_at": "..." },
      { "id": "perm_id_5", "module_id": "...", "action": "publish", "created_at": "..." }
    ]
  }
}
```

---

#### `PATCH /api/permissions/modules/:id`

Required permission: `permissions:edit`

Updates a permission module's label, name, or sort_order. System modules (`is_system: true`) cannot be renamed (name field rejected with `409`); `label` and `sort_order` remain editable.

**Body** (all optional):
```json
{
  "label": "Articles",
  "sort_order": 5
}
```

**Error conditions:**
- `404` — module not found
- `409` — name/slug conflict, or attempting to rename a system module

**Response 200:**
```json
{
  "success": true,
  "data": {
    "module": {
      "id": "...",
      "name": "blog-posts",
      "label": "Articles",
      "is_system": false,
      "sort_order": 5,
      "created_at": "...",
      "permissions": [ ... ]
    }
  }
}
```

---

#### `DELETE /api/permissions/modules/:id`

Required permission: `permissions:delete`

**Error conditions:**
- `404` — module not found
- `409` — system module: "Cannot delete a system module"
- `409` — permissions in this module are referenced by roles or user overrides: "Unable to delete: permissions in this module are assigned to roles or users"

**Response 200:**
```json
{ "success": true, "data": { "message": "Module deleted" } }
```

---

### Activity Log — `/api/activity-log`

Read-only. No write, edit, or delete endpoints.

#### `GET /api/activity-log`

Required permission: `activity-log:view`

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `actor` | string | Filter by actor user ID |
| `module` | string | Case-insensitive partial match on `module` field (e.g. `roles`, `users`) |
| `from` | ISO 8601 date | Inclusive lower bound on `created_at` |
| `to` | ISO 8601 date | Inclusive upper bound on `created_at` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "...",
        "module": "roles",
        "action": "created",
        "subject_type": "RbacRole",
        "subject_id": "...",
        "description": "Role \"Content Editor\" created",
        "properties": { "name": "Content Editor", "slug": "content-editor" },
        "ip_address": "127.0.0.1",
        "created_at": "2026-07-06T10:00:00.000Z",
        "actor": { "id": "...", "name": "Admin", "email": "admin@kdl.com" }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 }
  }
}
```

`actor` is `null` for system-generated entries. `properties` is PII-scrubbed (no passwords, no tokens). Returns `422` for invalid date filter values.

---

### Settings — `/api/settings`

#### `GET /api/settings`

Public settings returned for unauthenticated requests. Authenticated `ADMIN`/`SUPER_ADMIN` also receives private settings.

**Query:** `?page=1&limit=20`

---

#### `GET /api/settings/:key`

Same auth logic as list — public vs private based on caller role.

---

#### `POST /api/settings`

Requires `ADMIN` or `SUPER_ADMIN`.

**Body:**
```json
{
  "key": "feature_x",
  "value": "true",
  "type": "boolean",
  "description": "Enables feature X",
  "is_public": false
}
```

---

#### `PATCH /api/settings/:key`

Requires `ADMIN` or `SUPER_ADMIN`.

**Body** (all optional): same fields as POST.

---

#### `DELETE /api/settings/:key`

Requires `SUPER_ADMIN`.

---

### Media — `/api/media`

Requires authentication (any role).

#### `POST /api/media/upload`

Upload a file. Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`. Max size: 10MB.

**Request:** `multipart/form-data`, field name `file`.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "filename": "uuid.jpg",
    "original_name": "photo.jpg",
    "mime_type": "image/jpeg",
    "size": 204800,
    "url": "https://minio.../presigned-url..."
  }
}
```

`url` is a fresh 7-day presigned URL generated on each response (not stored in DB).

---

#### `GET /api/media`

List the authenticated user's media files.

**Query:** `?page=1&limit=20`

---

#### `DELETE /api/media/:id`

Delete a media file and remove from storage.

---

## AI Services — `http://localhost:5000`

**Auth:** Same JWT as backend — `Authorization: Bearer <accessToken>`.

### Health

#### `GET /health`

No auth required.

**Response 200:**
```json
{ "success": true, "data": { "status": "ok" } }
```

---

### Chat

#### `POST /api/ai/chat`

RAG-enhanced chat via the two-brain orchestrator. Routes to Claude (`CRITICAL`/`HIGH`) or OpenRouter (`MEDIUM`/`LOW`) based on `priority`.

**Body:**
```json
{
  "sessionId": "session-abc123",
  "messages": [
    { "role": "user", "content": "What is the refund policy?" }
  ],
  "priority": "MEDIUM"
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `sessionId` | string | Yes | Unique per conversation thread |
| `messages` | array | Yes | `[{ role: "user"\|"assistant", content: string }]` |
| `priority` | string | No | `CRITICAL`, `HIGH`, `MEDIUM` (default), `LOW` |

PII is scrubbed from messages before any model call.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "response": "The refund policy allows returns within 30 days...",
    "sessionId": "session-abc123",
    "model": "moonshot-ai/moonshot-v1-32k",
    "tokensUsed": 312
  }
}
```

**Response 503** (daily budget exhausted):
```json
{ "success": false, "message": "Daily AI budget exhausted. Request logged to MANUAL_TASKS.md." }
```

---

### Embed

#### `POST /api/ai/embed`

Generate embeddings via OpenRouter (`openai/text-embedding-3-small`).

**Body (single text):**
```json
{ "text": "The quick brown fox" }
```

**Body (batch):**
```json
{ "texts": ["First sentence", "Second sentence"] }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "embedding": [0.012, -0.034],
    "dimensions": 1536
  }
}
```

---

### Transcribe

#### `POST /api/ai/transcribe`

Transcribe audio via Whisper on OpenRouter (`openai/whisper-1`, override with `OPENROUTER_WHISPER_MODEL`). Budget-checked against the shared OpenRouter daily budget; transcript is PII-scrubbed before return; call is audit-logged.

**Body:**
```json
{
  "audio": "<base64-encoded audio>",
  "filename": "meeting.mp3",
  "language": "en",
  "sessionId": "abc-123"
}
```

- `audio` (required) — base64-encoded audio, max 7MB decoded
- `filename` (optional, default `audio.webm`) — extension determines format; allowed: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
- `language` (optional) — ISO language hint passed to Whisper
- `sessionId` (optional) — recorded in the audit log

**Response 200:**
```json
{
  "success": true,
  "data": {
    "transcript": "Hello, this is the transcribed text.",
    "language": "english",
    "duration": 12.4
  }
}
```

**Response 413** (audio too large):
```json
{ "success": false, "message": "Audio exceeds 7MB limit" }
```

**Response 503** (daily budget exhausted):
```json
{ "success": false, "message": "AI budget exhausted for today. Try again tomorrow." }
```
