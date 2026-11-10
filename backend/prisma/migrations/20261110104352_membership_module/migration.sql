-- CreateEnum
CREATE TYPE "MembershipMemberType" AS ENUM ('INDIVIDUAL', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "MembershipApprovalMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "MembershipPlanVisibility" AS ENUM ('PUBLIC', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "MembershipTaxMode" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "MembershipSubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_APPROVAL', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MembershipPaymentStatus" AS ENUM ('PENDING', 'AWAITING_PROOF', 'UNDER_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MembershipProviderType" AS ENUM ('GATEWAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "MembershipProviderStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipFieldAppliesTo" AS ENUM ('INDIVIDUAL', 'ORGANISATION', 'BOTH');

-- CreateEnum
CREATE TYPE "MembershipContactAccess" AS ENUM ('FULL', 'CONTENT', 'BILLING');

-- CreateEnum
CREATE TYPE "MembershipAccessTarget" AS ENUM ('PAGE', 'SECTION', 'MEDIA', 'URL_PATTERN');

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "approval_mode" "MembershipApprovalMode" NOT NULL DEFAULT 'AUTO',
    "visibility" "MembershipPlanVisibility" NOT NULL DEFAULT 'PUBLIC',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "member_types" "MembershipMemberType"[],
    "max_contacts" INTEGER NOT NULL DEFAULT 5,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plan_prices" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "interval" "MembershipInterval" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gst_rate" INTEGER NOT NULL DEFAULT 18,
    "tax_mode" "MembershipTaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_benefits" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "membership_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "member_no" TEXT,
    "member_type" "MembershipMemberType" NOT NULL DEFAULT 'INDIVIDUAL',
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "address" TEXT,
    "photo_url" TEXT,
    "legal_name" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "member_since" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_opt_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_subscriptions" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "price_id" TEXT,
    "status" "MembershipSubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "grace_ends_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "rejected_reason" TEXT,
    "suspended_reason" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "pending_plan_id" TEXT,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_payment_providers" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" "MembershipProviderType" NOT NULL DEFAULT 'GATEWAY',
    "label" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "status" "MembershipProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'TEST',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "credentials_enc" TEXT,
    "webhook_secret_enc" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "member_types" "MembershipMemberType"[],
    "regions" TEXT NOT NULL DEFAULT 'INDIA',
    "min_amount" INTEGER,
    "max_amount" INTEGER,
    "manual_config" JSONB NOT NULL DEFAULT '{}',
    "last_test_at" TIMESTAMP(3),
    "last_test_ok" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_payment_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_payment_provider_plans" (
    "provider_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,

    CONSTRAINT "membership_payment_provider_plans_pkey" PRIMARY KEY ("provider_id","plan_id")
);

-- CreateTable
CREATE TABLE "membership_payments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider_id" TEXT,
    "provider_option" TEXT,
    "status" "MembershipPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway_order_id" TEXT,
    "gateway_payment_id" TEXT,
    "utr" TEXT,
    "proof_url" TEXT,
    "note" TEXT,
    "failure_reason" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "refunded_amount" INTEGER NOT NULL DEFAULT 0,
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "is_credit_note" BOOLEAN NOT NULL DEFAULT false,
    "credit_for_id" TEXT,
    "member_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "payment_id" TEXT,
    "bill_to_name" TEXT NOT NULL,
    "bill_to_gstin" TEXT,
    "bill_to_address" TEXT,
    "description" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "gst_rate" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_access_rules" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "target" "MembershipAccessTarget" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_events" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "member_id" TEXT,
    "actor_id" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_field_groups" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "applies_to" "MembershipFieldAppliesTo" NOT NULL DEFAULT 'BOTH',
    "preset_key" TEXT,
    "ask_at_signup" BOOLEAN NOT NULL DEFAULT true,
    "member_editable" BOOLEAN NOT NULL DEFAULT true,
    "requires_review" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "member_field_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_fields" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "validation" JSONB NOT NULL DEFAULT '{}',
    "show_when" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'EDIT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "is_unique" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "member_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_field_values" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value_text" TEXT,
    "value_num" DOUBLE PRECISION,
    "value_date" TIMESTAMP(3),
    "value_bool" BOOLEAN,
    "value_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_field_groups" (
    "plan_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "member_type" "MembershipMemberType" NOT NULL DEFAULT 'INDIVIDUAL',
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plan_field_groups_pkey" PRIMARY KEY ("plan_id","group_id","member_type")
);

-- CreateTable
CREATE TABLE "membership_contacts" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "designation" TEXT,
    "access" "MembershipContactAccess" NOT NULL DEFAULT 'CONTENT',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_slug_key" ON "membership_plans"("slug");

-- CreateIndex
CREATE INDEX "membership_plans_visibility_sort_idx" ON "membership_plans"("visibility", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plan_prices_plan_id_interval_currency_key" ON "membership_plan_prices"("plan_id", "interval", "currency");

-- CreateIndex
CREATE INDEX "membership_benefits_plan_id_sort_idx" ON "membership_benefits"("plan_id", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "members_user_id_key" ON "members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_member_no_key" ON "members"("member_no");

-- CreateIndex
CREATE INDEX "members_email_idx" ON "members"("email");

-- CreateIndex
CREATE INDEX "members_mobile_idx" ON "members"("mobile");

-- CreateIndex
CREATE INDEX "members_member_type_idx" ON "members"("member_type");

-- CreateIndex
CREATE INDEX "membership_subscriptions_member_id_idx" ON "membership_subscriptions"("member_id");

-- CreateIndex
CREATE INDEX "membership_subscriptions_plan_id_idx" ON "membership_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "membership_subscriptions_status_ends_at_idx" ON "membership_subscriptions"("status", "ends_at");

-- CreateIndex
CREATE INDEX "membership_payment_providers_status_sort_idx" ON "membership_payment_providers"("status", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "membership_payments_reference_key" ON "membership_payments"("reference");

-- CreateIndex
CREATE INDEX "membership_payments_member_id_idx" ON "membership_payments"("member_id");

-- CreateIndex
CREATE INDEX "membership_payments_status_idx" ON "membership_payments"("status");

-- CreateIndex
CREATE INDEX "membership_payments_gateway_order_id_idx" ON "membership_payments"("gateway_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_invoices_number_key" ON "membership_invoices"("number");

-- CreateIndex
CREATE INDEX "membership_invoices_member_id_idx" ON "membership_invoices"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_invoices_fy_seq_is_credit_note_key" ON "membership_invoices"("fy", "seq", "is_credit_note");

-- CreateIndex
CREATE INDEX "membership_access_rules_plan_id_idx" ON "membership_access_rules"("plan_id");

-- CreateIndex
CREATE INDEX "membership_access_rules_target_value_idx" ON "membership_access_rules"("target", "value");

-- CreateIndex
CREATE INDEX "membership_events_member_id_created_at_idx" ON "membership_events"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "membership_events_key_idx" ON "membership_events"("key");

-- CreateIndex
CREATE UNIQUE INDEX "membership_webhook_events_provider_external_id_key" ON "membership_webhook_events"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_field_groups_key_key" ON "member_field_groups"("key");

-- CreateIndex
CREATE UNIQUE INDEX "member_fields_group_id_key_key" ON "member_fields"("group_id", "key");

-- CreateIndex
CREATE INDEX "member_field_values_field_id_value_text_idx" ON "member_field_values"("field_id", "value_text");

-- CreateIndex
CREATE UNIQUE INDEX "member_field_values_member_id_field_id_key" ON "member_field_values"("member_id", "field_id");

-- CreateIndex
CREATE INDEX "membership_contacts_member_id_idx" ON "membership_contacts"("member_id");

-- AddForeignKey
ALTER TABLE "membership_plan_prices" ADD CONSTRAINT "membership_plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_benefits" ADD CONSTRAINT "membership_benefits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "membership_plan_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_payment_provider_plans" ADD CONSTRAINT "membership_payment_provider_plans_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "membership_payment_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "membership_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "membership_payment_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_invoices" ADD CONSTRAINT "membership_invoices_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_invoices" ADD CONSTRAINT "membership_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "membership_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_invoices" ADD CONSTRAINT "membership_invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "membership_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_access_rules" ADD CONSTRAINT "membership_access_rules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_events" ADD CONSTRAINT "membership_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_fields" ADD CONSTRAINT "member_fields_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "member_field_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_field_values" ADD CONSTRAINT "member_field_values_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_field_values" ADD CONSTRAINT "member_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "member_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_field_groups" ADD CONSTRAINT "plan_field_groups_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_field_groups" ADD CONSTRAINT "plan_field_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "member_field_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_contacts" ADD CONSTRAINT "membership_contacts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
