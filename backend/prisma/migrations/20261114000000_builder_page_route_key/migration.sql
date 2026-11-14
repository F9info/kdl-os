-- One stored address name per page (see src/shared/page-routes.js). Additive: nothing is dropped or rewritten.
ALTER TABLE "builder_pages" ADD COLUMN "route_key" TEXT;

-- Pages the website stage generated carry their key in the slug (te-<run id>-<key>).
UPDATE "builder_pages"
SET "route_key" = substring("slug" from '^.+?-c[a-z0-9]{24}-(.+)$')
WHERE "route_key" IS NULL AND "template_id" IS NULL;

CREATE INDEX "builder_pages_project_id_route_key_idx" ON "builder_pages"("project_id", "route_key");
