-- AlterTable
ALTER TABLE "members" ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "membership_access_rules" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "non_member_view" TEXT NOT NULL DEFAULT 'EXCERPT_CTA';

-- AlterTable
ALTER TABLE "membership_benefits" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "membership_plan_prices" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sac_code" TEXT;

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "allow_plan_change" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_self_cancel" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "badge" TEXT,
ADD COLUMN     "grace_access" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role_on_activation" TEXT,
ADD COLUMN     "seat_limit" INTEGER,
ADD COLUMN     "show_badge_on_profile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';
