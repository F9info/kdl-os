-- CreateEnum
CREATE TYPE "MembershipDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "membership_payments" ADD COLUMN     "coupon_id" TEXT,
ADD COLUMN     "discount_amount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "membership_coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "MembershipDiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "plan_slugs" TEXT[],
    "max_redemptions" INTEGER,
    "per_member_limit" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_coupons_code_key" ON "membership_coupons"("code");

-- CreateIndex
CREATE INDEX "membership_payments_coupon_id_idx" ON "membership_payments"("coupon_id");

-- AddForeignKey
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "membership_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
