-- CreateEnum
CREATE TYPE "MembershipCommStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "whatsapp_opt_in_source" TEXT;

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "button_text" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT,
    "client_secret_enc" TEXT,
    "discovery_url" TEXT,
    "authorize_url" TEXT,
    "token_url" TEXT,
    "userinfo_url" TEXT,
    "scopes" TEXT NOT NULL DEFAULT 'openid email profile',
    "claim_map" JSONB NOT NULL DEFAULT '{}',
    "trust_email" BOOLEAN NOT NULL DEFAULT false,
    "auto_link" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '{}',
    "last_test_at" TIMESTAMP(3),
    "last_test_ok" BOOLEAN,
    "last_test_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_comm_events" (
    "key" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "channels" JSONB NOT NULL DEFAULT '{}',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_comm_events_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "membership_comm_templates" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT,
    "preheader" TEXT,
    "body" TEXT NOT NULL,
    "wa_template_name" TEXT,
    "wa_params" JSONB,
    "wa_button" JSONB,
    "link_url" TEXT,
    "icon" TEXT,
    "toast" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_comm_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_comm_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "member_id" TEXT,
    "recipient" TEXT,
    "status" "MembershipCommStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT,
    "body" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "provider_ref" TEXT,
    "provider_response" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "notification_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_comm_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_comm_preferences" (
    "member_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "membership_comm_preferences_pkey" PRIMARY KEY ("member_id","category","channel")
);

-- CreateTable
CREATE TABLE "membership_segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_codes_mobile_created_at_idx" ON "otp_codes"("mobile", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_key_key" ON "auth_providers"("key");

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_user_id_key" ON "user_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_comm_templates_event_key_channel_lang_key" ON "membership_comm_templates"("event_key", "channel", "lang");

-- CreateIndex
CREATE INDEX "membership_comm_logs_member_id_created_at_idx" ON "membership_comm_logs"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "membership_comm_logs_event_key_created_at_idx" ON "membership_comm_logs"("event_key", "created_at");

-- CreateIndex
CREATE INDEX "membership_comm_logs_status_created_at_idx" ON "membership_comm_logs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "membership_comm_logs_event_id_channel_key" ON "membership_comm_logs"("event_id", "channel");
