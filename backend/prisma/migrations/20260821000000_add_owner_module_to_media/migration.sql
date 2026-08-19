-- KDL-512: B1 — add owner_module to media, consistent with settings tables (KDL-192/197)
-- Without this column prisma.media.update({ data: { owner_module: '...' } }) throws before
-- issuing a query, causing every brand-kit logo upload to 500 after bytes land in storage.

ALTER TABLE "media" ADD COLUMN "owner_module" TEXT;

CREATE INDEX "media_owner_module_idx" ON "media"("owner_module");
