-- Yene Verify — domain constraints and hot-path indexes
-- These checks are database-level defense in depth; services validate the
-- same invariants before writing user-facing responses.

ALTER TABLE "users"
  ADD CONSTRAINT "users_phone_format_check"
  CHECK ("phone" ~ '^\+251[0-9]{9}$');

ALTER TABLE "users"
  ADD CONSTRAINT "users_preferred_language_check"
  CHECK ("preferred_language" IN ('en', 'am'));

ALTER TABLE "otp_codes"
  ADD CONSTRAINT "otp_attempts_check"
  CHECK ("attempts" >= 0 AND "max_attempts" > 0);

ALTER TABLE "packages"
  ADD CONSTRAINT "package_price_nonnegative_check"
  CHECK ("price_minor" IS NULL OR "price_minor" >= 0);

ALTER TABLE "packages"
  ADD CONSTRAINT "package_credits_positive_check"
  CHECK ("credits_per_month" IS NULL OR "credits_per_month" > 0);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscription_dates_check"
  CHECK ("expires_at" IS NULL OR "started_at" IS NULL OR "expires_at" > "started_at");

ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_tx_amount_nonzero_check"
  CHECK ("amount" <> 0);

ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_tx_balance_nonnegative_check"
  CHECK ("balance_after" >= 0);

ALTER TABLE "billing_verifications"
  ADD CONSTRAINT "billing_expected_amount_positive_check"
  CHECK ("expected_amount_minor" > 0);

ALTER TABLE "receipts"
  ADD CONSTRAINT "receipt_size_check"
  CHECK ("size_bytes" > 0 AND "size_bytes" <= 8388608);

ALTER TABLE "receipts"
  ADD CONSTRAINT "receipt_mime_type_check"
  CHECK ("mime_type" IN ('image/jpeg', 'image/png'));

ALTER TABLE "verifications"
  ADD CONSTRAINT "verification_amount_nonnegative_check"
  CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0);

ALTER TABLE "verifications"
  ADD CONSTRAINT "verification_confidence_check"
  CHECK ("ocr_confidence" IS NULL OR ("ocr_confidence" >= 0 AND "ocr_confidence" <= 1));

ALTER TABLE "verifications"
  ADD CONSTRAINT "verification_attempt_count_check"
  CHECK ("attempt_count" >= 1);

ALTER TABLE "transactions"
  ADD CONSTRAINT "transaction_amount_positive_check"
  CHECK ("amount_minor" > 0);

ALTER TABLE "merchants"
  ADD CONSTRAINT "merchant_credits_balance_nonnegative_check"
  CHECK ("credits_balance" >= 0);

ALTER TABLE "analytics_snapshots"
  ADD CONSTRAINT "analytics_period_check"
  CHECK ("period_end" > "period_start");

ALTER TABLE "analytics_snapshots"
  ADD CONSTRAINT "analytics_granularity_check"
  CHECK ("granularity" IN ('hour', 'day', 'week', 'month'));

-- One active subscription per merchant. Historical rows remain queryable.
CREATE UNIQUE INDEX "subscriptions_one_active_per_merchant"
  ON "subscriptions" ("merchant_id")
  WHERE "status" = 'ACTIVE';

-- Partial indexes for hot subsets and queue ordering.
CREATE INDEX "devices_active_push_idx"
  ON "devices" ("user_id", "push_token")
  WHERE "revoked_at" IS NULL AND "push_token" IS NOT NULL;

CREATE INDEX "sessions_active_idx"
  ON "sessions" ("user_id", "expires_at")
  WHERE "revoked_at" IS NULL;

CREATE INDEX "notifications_unread_idx"
  ON "notifications" ("user_id", "created_at" DESC)
  WHERE "read_at" IS NULL;

CREATE INDEX "billing_verifications_review_queue_idx"
  ON "billing_verifications" ("status", "created_at")
  WHERE "status" IN ('PENDING', 'NEEDS_REVIEW');

CREATE INDEX "verification_reviews_open_queue_idx"
  ON "verification_reviews" ("status", "created_at")
  WHERE "status" IN ('OPEN', 'IN_REVIEW');
