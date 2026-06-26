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
    "user": { "id": "...", "name": "Admin", "email": "admin@kdl.com", "role": "SUPER_ADMIN" },
    "accessToken": "eyJ..."
  }
}
```

Refresh token set as httpOnly cookie.

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
{ "success": true, "data": { "message": "Logged out" } }
```

---

### Users — `/api/users`

Requires `ADMIN` or `SUPER_ADMIN` role.

#### `GET /api/users`

List users with optional filters and pagination.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `is_active` | boolean | Filter by active status |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": [ { "id": "...", "name": "...", "email": "...", "role": "USER", "is_active": true } ],
    "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
  }
}
```

---

#### `GET /api/users/:id`

**Response 200:** Single user object (no password hash).

---

#### `PATCH /api/users/:id`

**Body** (all optional):
```json
{ "name": "New Name", "role": "ADMIN", "is_active": false }
```

`ADMIN` callers cannot set `role: SUPER_ADMIN` or modify/delete `SUPER_ADMIN` users.

---

#### `DELETE /api/users/:id`

Soft deletes (sets `is_active: false`).

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
    "embedding": [0.012, -0.034, ...],
    "dimensions": 1536
  }
}
```

---

### Transcribe

#### `POST /api/ai/transcribe`

**Response 501:**
```json
{ "success": false, "message": "Transcription not implemented. Whisper integration planned." }
```
