-- M3 (KDL-272): Add family_id to refresh_tokens for token-reuse detection.
-- When a revoked token is presented with a valid signature, the whole family is revoked.
-- Nullable so existing tokens (without a family_id) are unaffected.

ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" TEXT;

CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
