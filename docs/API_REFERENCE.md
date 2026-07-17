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
{ "email": "admin@kdl.com", "password": "<your SEED_ADMIN_PASSWORD>" }
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

### Modules — `/api/modules`

Manages the module plugin lifecycle. All endpoints require authentication. Super Admin bypasses permission checks.

**Module status flow:** `AVAILABLE` (manifest on disk, no DB row) → `INSTALLED` → `ENABLED` ↔ `DISABLED`.

**Cache:** Module enabled/disabled status is Redis-cached for up to 60 seconds. Edge enforcement lags toggle by at most 60 s.

#### `GET /api/modules`

Required permission: `modules:view`

Returns all modules — those with a manifest on disk merged with installed DB rows. Manifests with no DB row appear as `AVAILABLE`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "slug": "example",
        "name": "Example",
        "description": "Example module",
        "version": "1.0.0",
        "core": false,
        "apiPrefix": "/api/example",
        "status": "ENABLED",
        "installed_at": "2026-07-06T10:00:00.000Z",
        "enabled_at": "2026-07-06T10:00:00.000Z",
        "settings": null
      }
    ]
  }
}
```

`status` values: `AVAILABLE` | `INSTALLED` | `ENABLED` | `DISABLED`. Orphaned DB rows (manifest deleted from disk) include `"_orphaned": true`.

---

#### `GET /api/modules/enabled`

Required permission: authenticated (any active user).

Returns only `ENABLED` modules with their nav entries. Used by the frontend to build the dynamic sidebar.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "slug": "example",
        "name": "Example",
        "nav": [
          { "label": "Example", "path": "/example", "icon": "Package", "permission": "example:view" }
        ]
      }
    ]
  }
}
```

---

#### `POST /api/modules/:slug/install`

Required permission: `modules:add`

Installs a module: validates env vars, registers permission modules (upsert), creates a DB row with `status: INSTALLED`.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "module": {
      "id": "...",
      "slug": "example",
      "name": "Example",
      "version": "1.0.0",
      "is_core": false,
      "status": "INSTALLED",
      "installed_at": "2026-07-06T10:00:00.000Z",
      "enabled_at": null,
      "settings": null
    }
  }
}
```

**Error conditions:**
- `404` — no manifest found for `slug`
- `409` — already installed
- `409` — a declared `dependsOn` module is not installed
- `422` — one or more required `env` vars are missing from the environment

---

#### `POST /api/modules/:slug/enable`

Required permission: `modules:edit`

Transitions the module from `INSTALLED` or `DISABLED` to `ENABLED`. Invalidates the Redis module-status cache.

**Response 200:** `{ "module": { ..., "status": "ENABLED" } }`

**Error conditions:**
- `404` — module not installed
- `409` — already enabled
- `409` — a `dependsOn` module is not `ENABLED`

---

#### `POST /api/modules/:slug/disable`

Required permission: `modules:edit`

Transitions the module from `ENABLED` to `DISABLED`. Invalidates cache. Core modules cannot be disabled.

**Response 200:** `{ "module": { ..., "status": "DISABLED" } }`

**Error conditions:**
- `404` — module not installed
- `409` — module is core (`is_core: true`)
- `409` — module is not currently enabled
- `409` — one or more other `ENABLED` modules list this slug in their `dependsOn`

---

#### `DELETE /api/modules/:slug`

Required permission: `modules:delete`

Uninstalls a module: deregisters its permission modules (blocked if any roles or users reference them), deletes the DB row. **Tables created by the module are never dropped** — data purge is a manual, Prasanna-approved operation.

**Response 200:**
```json
{ "success": true, "data": { "message": "Module \"example\" uninstalled" } }
```

**Error conditions:**
- `404` — module not installed
- `409` — module is core
- `409` — module is not `DISABLED` (must disable before uninstalling)
- `409` — module's permission entries are still referenced by roles or user overrides

---

#### `PATCH /api/modules/:slug/settings`

Required permission: `modules:edit`

Merges the supplied key/value pairs into the module's `settings` JSON field (shallow merge — existing keys not in the body are preserved).

**Body:**
```json
{ "settings": { "someKey": "someValue" } }
```

**Response 200:** `{ "module": { ..., "settings": { "someKey": "someValue" } } }`

**Error conditions:**
- `404` — module not installed

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

Full media manager with folders, image variants, trash, and usage tracking. Requires authentication; all routes require `media` permission.

#### `POST /api/media/upload`

Upload one or more files. Allowed types and max size driven by `AppSetting` (`media.allowed_mime_types`, `media.max_file_size_mb`). Executables always rejected. Images undergo magic-byte validation (sharp) — fake images return 422. Images are asynchronously processed by the variant worker (BullMQ + sharp) to produce `thumb/small/medium/large` webp variants.

**Request:** `multipart/form-data`, field name `files` (up to 20 files). Single-file backward-compat alias: `POST /api/media/upload/single` with field `file`.

**Body (optional):** `folder_id` — place uploads directly into a folder.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "...",
        "original_name": "photo.jpg",
        "mime_type": "image/jpeg",
        "size": 204800,
        "type": "IMAGE",
        "width": 1920,
        "height": 1080,
        "url": "https://minio.../presigned-url",
        "variants": null,
        "folder_id": null
      }
    ]
  }
}
```

`url` and `variants.*` are fresh presigned URLs on each response (not stored in DB). `variants` is `null` until the worker completes.

---

#### `GET /api/media`

List media files (excludes trashed).

**Query:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Default 1 |
| `limit` | number | Default 20 |
| `folder_id` | string\|`null` | Filter by folder (`null` = root) |
| `type` | `IMAGE\|VIDEO\|AUDIO\|DOCUMENT\|OTHER` | Filter by type |
| `search` | string | Search name/title/alt_text |
| `date_from` | ISO date | Created after |
| `date_to` | ISO date | Created before |
| `sort` | `created_at_desc\|created_at_asc\|name_asc\|name_desc\|size_desc` | Sort order |

---

#### `GET /api/media/:id`

Get a single media file by ID.

---

#### `PATCH /api/media/:id`

Update metadata.

**Body:** `title`, `alt_text`, `caption`, `original_name` (all optional strings).

---

#### `DELETE /api/media/:id`

Soft-delete (move to trash). Returns **409** if file has active usages.

---

#### `POST /api/media/bulk-delete`

Soft-delete multiple files.

**Body:** `{ "media_ids": ["id1", "id2"] }`

Returns **409** with `detail` array if any files are in use.

---

#### `POST /api/media/move`

Move files between folders.

**Body:** `{ "media_ids": ["id1"], "folder_id": "folder-uuid" | null }`

---

### Folders — `/api/media/folders`

#### `GET /api/media/folders`

List all folders with child/media counts.

#### `POST /api/media/folders`

Create a folder.

**Body:** `{ "name": "Photos", "parent_id": "parent-uuid" | null }`

Max depth: 6 levels. Returns **409** if name already exists in parent.

#### `PATCH /api/media/folders/:id`

Rename or reparent a folder.

**Body:** `{ "name": "...", "parent_id": "..." | null }` (all optional).

Returns **422** on cycle or depth violation.

#### `DELETE /api/media/folders/:id`

Delete a folder. Returns **409** if not empty unless `?cascade=true` is passed. Cascade soft-deletes all contained media (does not hard-delete storage).

---

### Trash — `/api/media/trash`

#### `GET /api/media/trash`

List trashed files.

#### `POST /api/media/trash/restore`

Restore files from trash.

**Body:** `{ "media_ids": ["id1"] }`

#### `DELETE /api/media/trash/purge`

Permanently delete all trashed files from DB and MinIO storage. Activity-logged.

---

### Usage Tracking — `/api/media/usage`

#### `POST /api/media/usage/register`

Register a file as in-use by an entity (prevents deletion).

**Body:** `{ "media_id": "...", "entity": "user.avatar", "entity_id": "user-uuid" }`

Idempotent (upsert).

#### `POST /api/media/usage/release`

Release a usage record.

**Body:** `{ "media_id": "...", "entity": "user.avatar", "entity_id": "user-uuid" }`

#### `GET /api/media/:id/usage`

Get all usage records for a file.

---

### Processing Studio — `/api/media` (Phase C)

All processing endpoints enqueue a BullMQ job on the `media-processing` queue (concurrency 2, 10-min lock). Every destructive edit writes a new **MediaVersion** — originals are never mutated.

#### `GET /api/media/jobs/:jobId`

Poll job status.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "job-123",
    "name": "image-edit",
    "state": "completed",
    "progress": 100,
    "result": { ... },
    "failedReason": null,
    "timestamp": 1720000000000,
    "processedOn": 1720000001000,
    "finishedOn": 1720000002000
  }
}
```

`state` values: `waiting` | `active` | `completed` | `failed` | `delayed`

---

#### `GET /api/media/:id/versions`

List all versions of a media file, newest first.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "versions": [
      { "id": "...", "media_id": "...", "version": 1, "path": "...", "url": "https://...", "size": 12345, "checksum": "sha256...", "note": "grayscale", "created_at": "..." }
    ]
  }
}
```

---

#### `POST /api/media/:id/versions/:versionId/restore`

Overwrite the current media file with a prior version's content (updates `size` and `checksum`).

**Response 200:** `{ "success": true, "data": { "restored": true, "version": 1 } }`

---

#### `POST /api/media/:id/edit` — Image ops

Enqueue one or more image operations (applied in order). Returns a job immediately.

Required permission: `media:edit`

**Body:**
```json
{
  "ops": [
    { "op": "resize", "width": 800, "height": 600, "fit": "cover" },
    { "op": "grayscale" },
    { "op": "compress", "quality": 80 }
  ],
  "note": "optional label for the version"
}
```

| `op` | Extra fields | Notes |
|------|-------------|-------|
| `crop` | `left`, `top`, `width`, `height` | All integers, px |
| `resize` | `width?`, `height?`, `fit?` | `fit`: cover/contain/fill/inside/outside |
| `rotate` | `angle` | Degrees (90/180/270 or arbitrary) |
| `flip` | — | Vertical mirror |
| `flop` | — | Horizontal mirror |
| `brightness` | `factor` | 0–2 float |
| `contrast` | `factor` | 0–2 float |
| `saturation` | `factor` | 0–2 float |
| `grayscale` | — | |
| `blur` | `sigma?` | Default 3 |
| `sharpen` | — | |
| `negate` | — | Invert colours |
| `text_watermark` | `text`, `position?`, `opacity?`, `fontSize?`, `color?` | SVG composite |
| `logo_watermark` | `mediaId`, `position?`, `opacity?`, `size?` | Fetched from MinIO |
| `compress` | `quality?` | JPEG/WebP quality 1–100 |

**Response 202:**
```json
{ "success": true, "data": { "job_id": "...", "status": "queued" } }
```

---

#### `POST /api/media/:id/pdf-op` — Single-file PDF ops

#### `POST /api/media/pdf-merge` — PDF merge (multi-file)

Required permission: `media:edit` (merge requires `media:add`)

**Body (`op: merge`):**
```json
{ "op": "merge", "ids": ["id1", "id2"], "name": "merged.pdf" }
```

| `op` | Required fields | Notes |
|------|----------------|-------|
| `merge` | `ids[]` (2–50) | Produces new `Media` row; result contains `media_id` |
| `split` | `id`, `ranges[]` `{start,end}` | Each range → new MediaVersion |
| `compress` | `id` | qpdf linearise + compression |
| `password_protect` | `id`, `password` | qpdf owner+user password |
| `password_remove` | `id`, `password` | Removes encryption |
| `watermark` | `id`, `text`, `opacity?` | Via pdf-lib |
| `thumbnail` | `id` | First-page PNG via pdftoppm → new MediaVersion |
| `info` | `id` | Returns page count, title, author (no version written) |

**Response 202:**
```json
{ "success": true, "data": { "job_id": "...", "status": "queued" } }
```

---

#### `POST /api/media/:id/video-op` — Video ops

Required permission: `media:edit`

| `op` | Extra fields | Notes |
|------|-------------|-------|
| `thumbnail` | `time?` (default 1s) | Single PNG frame |
| `poster` | `time?` | Alias for thumbnail |
| `preview_clip` | `duration?` (1–30s) | First Ns as WebM |
| `trim` | `start`, `end` | ffmpeg -ss/-to, MP4 output |
| `transcode` | `preset`, `format?` | preset: 1080p/720p/480p/360p; format: mp4/webm |
| `watermark` | `text`, `position?`, `opacity?` | drawtext filter |
| `multi_resolution` | `presets[]` | Parallel transcodes; result has `versions[]` |
| `hls` | `presets[]` | HLS renditions (requires `media.hls_enabled` setting) |

**Response 202:**
```json
{ "success": true, "data": { "job_id": "...", "status": "queued" } }
```

---

#### `POST /api/media/:id/audio-op` — Audio ops

Required permission: `media:edit`

| `op` | Extra fields | Notes |
|------|-------------|-------|
| `waveform` | — | 200-bar peaks JSON + PNG via showwavespic; result: `{ peaks[], waveformUrl }` |
| `trim` | `start`, `end` | ffmpeg -ss/-to |
| `normalize` | — | ffmpeg loudnorm filter |
| `convert` | `format` | mp3/wav/aac/ogg/flac |

**Response 202:**
```json
{ "success": true, "data": { "job_id": "...", "status": "queued" } }
```

---

#### `POST /api/media/:id/convert` — Format conversion matrix

Required permission: `media:edit`

| From → To | Supported |
|-----------|-----------|
| image → webp/avif/png/jpeg | ✅ via sharp |
| video → mp4/webm | ✅ libx264/vp9 |
| audio → mp3/wav | ✅ fluent-ffmpeg |
| doc → pdf | ❌ excluded v1 (LibreOffice weight — see DECISIONS.md) |

**Body:** `{ "to": "webp", "quality": 85 }`

**Response 202:** `{ "success": true, "data": { "job_id": "...", "status": "queued" } }`

---

### Integrations — `/api/integrations`

Plugin module (non-core). All endpoints require the `integrations` module to be **ENABLED** — requests to a disabled module return `403 Module not enabled`. Webhook endpoints have no auth requirement (public inbound); all provider/log endpoints require `Authorization: Bearer <accessToken>`.

**Provider response shape** (credentials are never returned — only `credentials_set: true`):
```json
{
  "id": "clx...",
  "channel": "SMS",
  "driver": "msg91",
  "name": "MSG91 Production",
  "config": { "sender_id": "KDLAPP" },
  "is_active": true,
  "is_default": true,
  "is_fallback": false,
  "credentials_set": true,
  "created_at": "2026-07-01T10:00:00.000Z",
  "updated_at": "2026-07-01T10:00:00.000Z"
}
```

---

#### `GET /api/integrations/providers`

Required permission: `integrations:view`

List all configured providers ordered by channel then creation date.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "...", "channel": "SMS", "driver": "msg91", "name": "MSG91 Production", "config": {}, "is_active": true, "is_default": true, "is_fallback": false, "credentials_set": true, "created_at": "...", "updated_at": "..." }
    ]
  }
}
```

---

#### `POST /api/integrations/providers`

Required permission: `integrations:add`

Create a new integration provider. Credentials are encrypted with AES-256-GCM before storage.

**Body:**
```json
{
  "channel": "SMS",
  "driver": "msg91",
  "name": "MSG91 Production",
  "credentials": { "api_key": "..." },
  "config": { "sender_id": "KDLAPP" },
  "is_active": true,
  "is_default": true,
  "is_fallback": false
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `channel` | Yes | `EMAIL` \| `SMS` \| `WHATSAPP` |
| `driver` | Yes | `smtp` \| `msg91` \| `twilio` \| `meta-cloud` \| `gupshup` |
| `name` | Yes | 1–100 chars. Display name. |
| `credentials` | Yes | Driver-specific secret object — stored encrypted, never returned. |
| `config` | No | Non-secret driver config (sender ID, from address, WABA number). Stored plaintext. |
| `is_active` | No | Default `false`. Only active providers receive dispatched messages. |
| `is_default` | No | Default `false`. At most one default per channel — `409` if a default already exists for this channel. |
| `is_fallback` | No | Default `false`. Fallback provider used when the default fails. |

**Response 201:** `{ "item": { ...provider } }`

**Error conditions:**
- `409` — a default provider for this channel already exists
- `422` — unknown driver, driver/channel mismatch, invalid credentials or config schema

---

#### `PATCH /api/integrations/providers/:id`

Required permission: `integrations:edit`

Update a provider's metadata, credentials, or flags. All fields optional; only supplied fields are changed.

**Body** (all optional):
```json
{
  "name": "MSG91 Backup",
  "credentials": { "api_key": "new-key" },
  "config": { "sender_id": "KDLBKP" },
  "is_active": false,
  "is_default": false,
  "is_fallback": true
}
```

**Response 200:** `{ "item": { ...provider } }`

**Error conditions:**
- `404` — provider not found
- `409` — setting `is_default: true` when another default already exists for this channel
- `422` — invalid credentials or config schema

---

#### `DELETE /api/integrations/providers/:id`

Required permission: `integrations:delete`

Delete a provider. Cannot delete a default provider while jobs are queued.

**Response 204:** Empty body.

**Error conditions:**
- `404` — provider not found
- `409` — provider is the default and the integrations queue has waiting jobs

---

#### `POST /api/integrations/providers/:id/test`

Required permission: `integrations:edit`

Enqueue a test message via this specific provider (bypasses default selection). Creates an `IntegrationLog` row with `source: "test"` and returns its ID immediately — delivery is async.

**Body:**
```json
{
  "to": "+919876543210",
  "subject": "Test subject (EMAIL only)",
  "body": "Hello from KDL test send"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `to` | Yes | Recipient — email address for EMAIL, E.164 phone for SMS/WHATSAPP. |
| `subject` | No | Required for EMAIL channel; ignored for SMS/WHATSAPP. |
| `body` | Yes | Message body. Min 1 char. |

**Response 200:**
```json
{ "success": true, "data": { "log_id": "clx..." } }
```

**Error conditions:**
- `404` — provider not found
- `422` — validation failure

---

#### `GET /api/integrations/webhooks/:driver`

No auth required. Used by some providers (currently `meta-cloud`) to verify webhook endpoint ownership via a GET challenge during provider dashboard setup.

`driver` must be a registered driver name — `404` for unknown drivers. Returns `405` if the driver does not implement `verifyGetChallenge`. Returns `403` if the challenge cannot be verified against any active provider's config.

Meta Cloud passes `hub.mode`, `hub.verify_token`, and `hub.challenge` as query params; a valid token returns the raw `hub.challenge` string.

---

#### `POST /api/integrations/webhooks/:driver`

No auth required. Receives inbound delivery status callbacks from providers. The request is verified against the signature of every active provider for that driver — `401` if no signature matches. Correlated to a log entry via `provider_ref`; updates `status` (and `delivered_at` for `DELIVERED`/`READ` events). Always returns `200` to the provider after verification.

`driver` must be a registered driver name — `404` for unknown.

---

#### `GET /api/integrations/logs`

Required permission: `integrations:view`

Delivery log with filters and pagination. Ordered by `created_at` descending.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `channel` | `EMAIL`\|`SMS`\|`WHATSAPP` | Filter by channel |
| `status` | `QUEUED`\|`SENT`\|`DELIVERED`\|`READ`\|`FAILED` | Filter by delivery status |
| `source` | string | Filter by source (e.g. `test`, `notifications`, `auth.password-reset`) |
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
        "channel": "SMS",
        "recipient": "98*****210",
        "subject": null,
        "status": "DELIVERED",
        "source": "test",
        "provider_ref": "msg91-msgid-abc",
        "error": null,
        "attempts": 1,
        "sent_at": "2026-07-01T10:01:00.000Z",
        "delivered_at": "2026-07-01T10:01:05.000Z",
        "created_at": "2026-07-01T10:00:00.000Z",
        "provider": { "id": "...", "name": "MSG91 Production", "driver": "msg91" }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
  }
}
```

Recipient is always masked at write time (`p***@x.com` / `98*****210`). `body_preview` is not returned in the list — first 120 chars stored PII-scrubbed.

---

### Notifications — `/api/notifications`

> Requires module `notifications` ENABLED. All routes return 404 when module is disabled.

**Permissions** (admin routes): `notifications:view`, `notifications:add`, `notifications:edit`, `notifications:delete`, `notifications:publish`.

#### User-facing endpoints (own data only)

##### `GET /api/notifications`

Own notification list, paginated.

| Query | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |
| `unread` | bool | — | Filter to unread only |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "clx...", "category_slug": "activity", "title": "Welcome", "body": "Hello World", "read_at": null, "data": {"url": "/admin/dashboard"}, "created_at": "2026-07-08T00:00:00Z" }
    ],
    "total": 1, "page": 1, "limit": 20
  }
}
```

---

##### `GET /api/notifications/unread-count`

Cheap poll endpoint for badge count.

**Response 200:**
```json
{ "success": true, "data": { "count": 3 } }
```

---

##### `PATCH /api/notifications/:id/read`

Mark one notification read. Returns 404 if notification belongs to another user.

**Response 200:**
```json
{ "success": true, "data": { "notification": { "id": "clx...", "read_at": "2026-07-08T00:00:00Z" } } }
```

---

##### `POST /api/notifications/read-all`

Mark all own notifications read.

**Response 200:**
```json
{ "success": true, "data": { "updated": 5 } }
```

---

##### `DELETE /api/notifications/:id`

Delete own notification. Returns 404 if notification belongs to another user.

**Response 200:**
```json
{ "success": true, "data": { "deleted": true } }
```

---

##### `GET /api/notifications/stream`

SSE stream — real-time notification push. Use `?token=<accessToken>` (EventSource cannot set headers).

**Response:** `text/event-stream`. Each event is two lines followed by a blank line:
```
event: notification
data: {"id":"clx...","title":"Alert","body":"Something happened","data":{"url":"/admin/users/x"},"created_at":"2026-07-08T00:00:00Z"}

```

Heartbeat comment (`: heartbeat`) sent every 25 s. Max 3 concurrent streams per user; oldest closed on new connection.

**nginx setup required** (see SETUP.md):
```nginx
location /api/notifications/stream {
  proxy_pass http://backend;
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
}
```

---

##### `GET /api/notifications/preferences`

Own preference matrix (category × channel toggles).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "preferences": [
      {
        "category_id": "clx...",
        "category_slug": "security",
        "category_name": "Security",
        "channels": [
          { "channel": "IN_APP", "enabled": true },
          { "channel": "EMAIL", "enabled": true },
          { "channel": "SMS", "enabled": true },
          { "channel": "WHATSAPP", "enabled": true }
        ]
      }
    ]
  }
}
```

---

##### `PUT /api/notifications/preferences`

Update own preferences.

**Body:**
```json
{
  "preferences": [
    { "category_id": "clx...", "channel": "EMAIL", "enabled": false }
  ]
}
```

**Response 200:**
```json
{ "success": true, "data": { "updated": 1 } }
```

---

#### Admin endpoints

##### `GET /api/notifications/categories`

Permission: `notifications:view`

**Response 200:**
```json
{ "success": true, "data": { "categories": [ { "id": "clx...", "slug": "security", "name": "Security", "is_system": true } ] } }
```

---

##### `POST /api/notifications/categories`

Permission: `notifications:add`

**Body:**
```json
{ "slug": "marketing", "name": "Marketing", "description": "Promotional messages" }
```

---

##### `PATCH /api/notifications/categories/:id`

Permission: `notifications:edit`. Updates `name` or `description`. The `is_system` field is silently ignored — it cannot be changed via API. Returns 404 if category not found.

---

##### `GET /api/notifications/templates`

Permission: `notifications:view`

---

##### `POST /api/notifications/templates`

Permission: `notifications:add`

**Body:**
```json
{
  "slug": "user.welcome",
  "category_id": "clx...",
  "name": "Welcome User",
  "variables": ["user_name"],
  "in_app_body": "Welcome, {{user_name}}!",
  "email_subject": "Welcome to KDL",
  "email_body": "<p>Hello {{user_name}}, welcome!</p>",
  "sms_body": null,
  "whatsapp_body": null
}
```

---

##### `PATCH /api/notifications/templates/:id`

Permission: `notifications:edit`

---

##### `DELETE /api/notifications/templates/:id`

Permission: `notifications:delete`. Returns 409 if template is a system seed.

---

##### `POST /api/notifications/templates/:id/preview`

Permission: `notifications:view`. Renders template with sample data per channel.

**Body:**
```json
{ "data": { "user_name": "Prasanna" } }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "preview": {
      "in_app": "Welcome, Prasanna!",
      "email_subject": "Welcome to KDL",
      "email_body": "<p>Hello Prasanna, welcome!</p>",
      "sms": null,
      "whatsapp": null
    }
  }
}
```

---

##### `POST /api/notifications/broadcast`

Permission: `notifications:publish`. Queues a batch notification to a role or all users.

**Body:**
```json
{
  "to": { "all": true },
  "template": "system.broadcast",
  "data": { "message": "Maintenance scheduled for Sunday" },
  "channels": ["IN_APP", "EMAIL"]
}
```

Or with `role_slug`:
```json
{ "to": { "role_slug": "admin" }, "inline": { "title": "Alert", "body": "Check the dashboard." }, "channels": ["IN_APP"] }
```

`to` must specify **exactly one** of `all` or `role_slug`. Either `template` (slug) or `inline` (`{title, body}`) must be provided.

**Response 200 (inline — small batch):**
```json
{ "success": true, "data": { "sent": 42 } }
```

**Response 200 (queued — large batch or external channels):**
```json
{ "success": true, "data": { "batch_id": "1234", "recipient_count": 500 } }
```

---

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
