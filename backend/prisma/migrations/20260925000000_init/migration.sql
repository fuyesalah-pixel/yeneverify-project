-- Yene Verify — initial schema migration
-- Extensions are created here as well as in docker/init so managed
-- PostgreSQL deployments do not depend on a container init script.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Least-privilege database roles. Login credentials are provisioned by the
-- hosting platform; these are group roles and never store a password.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yene_app') THEN
    CREATE ROLE yene_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yene_migrator') THEN
    CREATE ROLE yene_migrator NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yene_readonly') THEN
    CREATE ROLE yene_readonly NOLOGIN;
  END IF;
END
$$;

-- RLS context helpers. SET LOCAL values are set by TenantGuard inside a
-- transaction and never persist beyond it.
CREATE OR REPLACE FUNCTION set_tenant(p_merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_merchant_id', p_merchant_id::TEXT, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION current_merchant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_merchant_id', TRUE), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_role', TRUE), '');
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(current_user_role() = 'ADMIN', FALSE);
$$;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'MERCHANT', 'SUB_MERCHANT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "merchant_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "sub_merchant_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('LOGIN', 'DEVICE_BIND', 'PHONE_CHANGE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "bank_code" AS ENUM ('CBE', 'TELEBIRR', 'AWASH', 'DASHEN', 'ABYSSINIA', 'MPESA', 'ZEMEN');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'VERIFIED', 'FAKE', 'DUPLICATE', 'NEEDS_REVIEW', 'ERROR');

-- CreateEnum
CREATE TYPE "verification_source" AS ENUM ('TRANSACTION', 'BILLING');

-- CreateEnum
CREATE TYPE "verification_input" AS ENUM ('PHOTO', 'UPLOAD');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'VERIFIED', 'FAKE', 'DUPLICATE', 'NEEDS_REVIEW', 'ERROR');

-- CreateEnum
CREATE TYPE "package_code" AS ENUM ('FREE', 'PREMIUM', 'BUSINESS', 'BUSINESS_PRO', 'API');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT');

-- CreateEnum
CREATE TYPE "credit_tx_type" AS ENUM ('GRANT', 'CONSUME', 'REFUND', 'ADJUSTMENT', 'EXPIRE');

-- CreateEnum
CREATE TYPE "billing_status" AS ENUM ('PENDING', 'VERIFIED', 'AMOUNT_MISMATCH', 'DUPLICATE', 'FAKE', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('PUSH', 'IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('VERIFICATION_RESULT', 'CREDIT_LOW', 'CREDIT_EXHAUSTED', 'BILLING_APPROVED', 'BILLING_REJECTED', 'SUB_MERCHANT_INVITED', 'SUB_MERCHANT_JOINED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "export_format" AS ENUM ('CSV', 'PDF');

-- CreateEnum
CREATE TYPE "export_status" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('USER', 'SYSTEM', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "full_name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "ip" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "platform" "device_platform" NOT NULL,
    "model" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "push_token" TEXT,
    "push_token_updated_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "business_type" TEXT,
    "tin" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "status" "merchant_status" NOT NULL DEFAULT 'PENDING',
    "credits_balance" BIGINT NOT NULL DEFAULT 0,
    "credits_updated_at" TIMESTAMPTZ(6),
    "current_package_code" "package_code",
    "subscription_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_merchants" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_label" TEXT,
    "status" "sub_merchant_status" NOT NULL DEFAULT 'INVITED',
    "invited_by_user_id" UUID,
    "invited_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6),
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sub_merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "code" "package_code" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_minor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "credits_per_month" INTEGER,
    "unlimited" BOOLEAN NOT NULL DEFAULT false,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "package_code" "package_code" NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "started_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "billing_verification_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "type" "credit_tx_type" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "subscription_id" UUID,
    "verification_id" UUID,
    "billing_verification_id" UUID,
    "reason" TEXT,
    "actor_user_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_verifications" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "package_code" "package_code" NOT NULL,
    "expected_amount_minor" BIGINT NOT NULL,
    "submitted_amount_minor" BIGINT,
    "sender_name" TEXT,
    "receiver_name" TEXT,
    "bank_code" "bank_code",
    "bank_reference" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "receipt_id" UUID NOT NULL,
    "verification_id" UUID,
    "status" "billing_status" NOT NULL DEFAULT 'PENDING',
    "reviewer_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" TEXT,
    "subscription_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT NOT NULL,
    "input_method" "verification_input" NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "verified_by_user_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "source" "verification_source" NOT NULL,
    "bank_code" "bank_code",
    "bank_reference" TEXT,
    "reference_normalized" TEXT,
    "amount_minor" BIGINT,
    "sender_name" TEXT,
    "receiver_name" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "ocr_raw_text" TEXT,
    "ocr_confidence" DECIMAL(4,3),
    "adapter_metadata" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "sub_merchant_id" UUID,
    "verified_by_user_id" UUID NOT NULL,
    "bank_code" "bank_code" NOT NULL,
    "bank_reference" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "sender_name" TEXT,
    "receiver_name" TEXT,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "transaction_status" NOT NULL,
    "product_label" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_fingerprints" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bank_code" "bank_code" NOT NULL,
    "bank_reference" TEXT NOT NULL,
    "first_verification_id" UUID NOT NULL,
    "first_merchant_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_hits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "duplicate_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_reviews" (
    "id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "status" "review_status" NOT NULL DEFAULT 'OPEN',
    "requested_by_user_id" UUID,
    "reason" TEXT,
    "resolved_by_user_id" UUID,
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "actor_user_id" UUID,
    "merchant_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "ip" INET,
    "user_agent" TEXT,
    "request_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "merchant_id" UUID,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "channel" "notification_channel" NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "pushed_at" TIMESTAMPTZ(6),
    "push_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "format" "export_format" NOT NULL,
    "params" JSONB NOT NULL,
    "status" "export_status" NOT NULL DEFAULT 'QUEUED',
    "storage_key" TEXT,
    "file_size_bytes" INTEGER,
    "row_count" INTEGER,
    "error_message" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "granularity" TEXT NOT NULL,
    "snapshot_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "model_version" TEXT NOT NULL DEFAULT 'rules-v1',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reference_lookups" (
    "id" UUID NOT NULL,
    "bank_code" "bank_code" NOT NULL,
    "reference_normalized" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_reference_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "metadata" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_created_at_idx" ON "otp_codes"("phone", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "devices_push_token_idx" ON "devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_fingerprint_key" ON "devices"("user_id", "device_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_device_id_idx" ON "sessions"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_owner_user_id_key" ON "merchants"("owner_user_id");

-- CreateIndex
CREATE INDEX "merchants_status_idx" ON "merchants"("status");

-- CreateIndex
CREATE INDEX "merchants_current_package_code_idx" ON "merchants"("current_package_code");

-- CreateIndex
CREATE INDEX "merchants_subscription_id_idx" ON "merchants"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_merchants_user_id_key" ON "sub_merchants"("user_id");

-- CreateIndex
CREATE INDEX "sub_merchants_merchant_id_idx" ON "sub_merchants"("merchant_id");

-- CreateIndex
CREATE INDEX "sub_merchants_invited_by_user_id_idx" ON "sub_merchants"("invited_by_user_id");

-- CreateIndex
CREATE INDEX "sub_merchants_status_idx" ON "sub_merchants"("status");

-- CreateIndex
CREATE INDEX "subscriptions_merchant_id_idx" ON "subscriptions"("merchant_id");

-- CreateIndex
CREATE INDEX "subscriptions_package_code_idx" ON "subscriptions"("package_code");

-- CreateIndex
CREATE INDEX "subscriptions_billing_verification_id_idx" ON "subscriptions"("billing_verification_id");

-- CreateIndex
CREATE INDEX "subscriptions_merchant_id_status_idx" ON "subscriptions"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_expires_at_idx" ON "subscriptions"("expires_at");

-- CreateIndex
CREATE INDEX "credit_transactions_merchant_id_idx" ON "credit_transactions"("merchant_id");

-- CreateIndex
CREATE INDEX "credit_transactions_merchant_id_created_at_idx" ON "credit_transactions"("merchant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions"("type");

-- CreateIndex
CREATE INDEX "credit_transactions_verification_id_idx" ON "credit_transactions"("verification_id");

-- CreateIndex
CREATE INDEX "credit_transactions_billing_verification_id_idx" ON "credit_transactions"("billing_verification_id");

-- CreateIndex
CREATE INDEX "credit_transactions_actor_user_id_idx" ON "credit_transactions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_verifications_verification_id_key" ON "billing_verifications"("verification_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_verifications_subscription_id_key" ON "billing_verifications"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_verifications_merchant_id_idx" ON "billing_verifications"("merchant_id");

-- CreateIndex
CREATE INDEX "billing_verifications_status_idx" ON "billing_verifications"("status");

-- CreateIndex
CREATE INDEX "billing_verifications_status_created_at_idx" ON "billing_verifications"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "billing_verifications_package_code_idx" ON "billing_verifications"("package_code");

-- CreateIndex
CREATE INDEX "billing_verifications_receipt_id_idx" ON "billing_verifications"("receipt_id");

-- CreateIndex
CREATE INDEX "billing_verifications_reviewer_user_id_idx" ON "billing_verifications"("reviewer_user_id");

-- CreateIndex
CREATE INDEX "billing_verifications_bank_reference_idx" ON "billing_verifications"("bank_reference");

-- CreateIndex
CREATE INDEX "receipts_merchant_id_idx" ON "receipts"("merchant_id");

-- CreateIndex
CREATE INDEX "receipts_uploaded_by_user_id_idx" ON "receipts"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "receipts_sha256_idx" ON "receipts"("sha256");

-- CreateIndex
CREATE INDEX "receipts_expires_at_idx" ON "receipts"("expires_at");

-- CreateIndex
CREATE INDEX "verifications_merchant_id_idx" ON "verifications"("merchant_id");

-- CreateIndex
CREATE INDEX "verifications_verified_by_user_id_idx" ON "verifications"("verified_by_user_id");

-- CreateIndex
CREATE INDEX "verifications_merchant_id_created_at_idx" ON "verifications"("merchant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "verifications_bank_reference_idx" ON "verifications"("bank_reference");

-- CreateIndex
CREATE INDEX "verifications_reference_normalized_idx" ON "verifications"("reference_normalized");

-- CreateIndex
CREATE INDEX "verifications_status_idx" ON "verifications"("status");

-- CreateIndex
CREATE INDEX "verifications_source_status_idx" ON "verifications"("source", "status");

-- CreateIndex
CREATE INDEX "verifications_receipt_id_idx" ON "verifications"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_verification_id_key" ON "transactions"("verification_id");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_idx" ON "transactions"("merchant_id");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_paid_at_idx" ON "transactions"("merchant_id", "paid_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_merchant_id_status_idx" ON "transactions"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "transactions_sub_merchant_id_idx" ON "transactions"("sub_merchant_id");

-- CreateIndex
CREATE INDEX "transactions_verified_by_user_id_idx" ON "transactions"("verified_by_user_id");

-- CreateIndex
CREATE INDEX "transactions_bank_reference_idx" ON "transactions"("bank_reference");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_fingerprints_fingerprint_key" ON "duplicate_fingerprints"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_fingerprints_first_verification_id_key" ON "duplicate_fingerprints"("first_verification_id");

-- CreateIndex
CREATE INDEX "duplicate_fingerprints_first_verification_id_idx" ON "duplicate_fingerprints"("first_verification_id");

-- CreateIndex
CREATE INDEX "duplicate_fingerprints_first_merchant_id_idx" ON "duplicate_fingerprints"("first_merchant_id");

-- CreateIndex
CREATE INDEX "duplicate_fingerprints_first_seen_at_idx" ON "duplicate_fingerprints"("first_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_reviews_verification_id_key" ON "verification_reviews"("verification_id");

-- CreateIndex
CREATE INDEX "verification_reviews_status_created_at_idx" ON "verification_reviews"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "verification_reviews_merchant_id_idx" ON "verification_reviews"("merchant_id");

-- CreateIndex
CREATE INDEX "audit_logs_merchant_id_created_at_idx" ON "audit_logs"("merchant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_merchant_id_idx" ON "notifications"("merchant_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "exports_merchant_id_idx" ON "exports"("merchant_id");

-- CreateIndex
CREATE INDEX "exports_merchant_id_created_at_idx" ON "exports"("merchant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "exports_requested_by_user_id_idx" ON "exports"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "exports_status_idx" ON "exports"("status");

-- CreateIndex
CREATE INDEX "analytics_snapshots_merchant_id_snapshot_type_period_start_idx" ON "analytics_snapshots"("merchant_id", "snapshot_type", "period_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_merchant_id_snapshot_type_period_start__key" ON "analytics_snapshots"("merchant_id", "snapshot_type", "period_start", "period_end", "granularity");

-- CreateIndex
CREATE INDEX "bank_reference_lookups_expires_at_idx" ON "bank_reference_lookups"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_reference_lookups_bank_code_reference_normalized_key" ON "bank_reference_lookups"("bank_code", "reference_normalized");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_merchants" ADD CONSTRAINT "sub_merchants_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_merchants" ADD CONSTRAINT "sub_merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_merchants" ADD CONSTRAINT "sub_merchants_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_package_code_fkey" FOREIGN KEY ("package_code") REFERENCES "packages"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_billing_verification_id_fkey" FOREIGN KEY ("billing_verification_id") REFERENCES "billing_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_verifications" ADD CONSTRAINT "billing_verifications_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_verifications" ADD CONSTRAINT "billing_verifications_package_code_fkey" FOREIGN KEY ("package_code") REFERENCES "packages"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_verifications" ADD CONSTRAINT "billing_verifications_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_verifications" ADD CONSTRAINT "billing_verifications_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_verifications" ADD CONSTRAINT "billing_verifications_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_verifications" ADD CONSTRAINT "billing_verifications_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sub_merchant_id_fkey" FOREIGN KEY ("sub_merchant_id") REFERENCES "sub_merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_fingerprints" ADD CONSTRAINT "duplicate_fingerprints_first_verification_id_fkey" FOREIGN KEY ("first_verification_id") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_fingerprints" ADD CONSTRAINT "duplicate_fingerprints_first_merchant_id_fkey" FOREIGN KEY ("first_merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Role grants. The application role is subject to RLS; the migrator role is
-- reserved for Prisma migrations and has BYPASSRLS.
GRANT USAGE ON SCHEMA public TO yene_app, yene_migrator, yene_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yene_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO yene_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO yene_app, yene_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yene_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO yene_readonly;

