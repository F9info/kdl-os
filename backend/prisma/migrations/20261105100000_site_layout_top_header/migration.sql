-- AlterTable: the layout picker has three slots (top header, header, footer); the table only had two.
ALTER TABLE "site_layouts" ADD COLUMN     "top_header" JSONB NOT NULL DEFAULT '{}';
