-- Yene Verify — UUID fallbacks and updated_at triggers
-- Application code supplies UUIDv7 values through newId(). These database
-- defaults are only a safety net for administrative/import paths.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "otp_codes" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "devices" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "merchants" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "sub_merchants" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "subscriptions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "credit_transactions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "billing_verifications" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "receipts" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "verifications" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "transactions" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "duplicate_fingerprints" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "verification_reviews" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "notifications" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "exports" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "analytics_snapshots" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "bank_reference_lookups" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();

-- Mutable tables only. Immutable ledgers deliberately have no updated_at.
DROP TRIGGER IF EXISTS users_set_updated_at ON "users";
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS merchants_set_updated_at ON "merchants";
CREATE TRIGGER merchants_set_updated_at
  BEFORE UPDATE ON "merchants"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sub_merchants_set_updated_at ON "sub_merchants";
CREATE TRIGGER sub_merchants_set_updated_at
  BEFORE UPDATE ON "sub_merchants"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS packages_set_updated_at ON "packages";
CREATE TRIGGER packages_set_updated_at
  BEFORE UPDATE ON "packages"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON "subscriptions";
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON "subscriptions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS billing_verifications_set_updated_at ON "billing_verifications";
CREATE TRIGGER billing_verifications_set_updated_at
  BEFORE UPDATE ON "billing_verifications"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS verifications_set_updated_at ON "verifications";
CREATE TRIGGER verifications_set_updated_at
  BEFORE UPDATE ON "verifications"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS transactions_set_updated_at ON "transactions";
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS verification_reviews_set_updated_at ON "verification_reviews";
CREATE TRIGGER verification_reviews_set_updated_at
  BEFORE UPDATE ON "verification_reviews"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS exports_set_updated_at ON "exports";
CREATE TRIGGER exports_set_updated_at
  BEFORE UPDATE ON "exports"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS feature_flags_set_updated_at ON "feature_flags";
CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON "feature_flags"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
