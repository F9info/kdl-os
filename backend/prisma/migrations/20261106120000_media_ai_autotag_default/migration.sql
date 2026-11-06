-- Data only. The admin AI settings page reads `media.ai_autotag` on every visit; the row used to be
-- created lazily on first toggle, so the first read was a 404 (console error on every visit).
-- Ship the default (off, as isAiAutotagEnabled() already treats a missing row) without touching
-- an existing value.
INSERT INTO "app_settings" ("id", "key", "value", "type", "description", "is_public", "created_at", "updated_at")
VALUES (
  'media_ai_autotag_default',
  'media.ai_autotag',
  'false',
  'boolean',
  'Auto-analyze images on upload with the configured vision provider',
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
