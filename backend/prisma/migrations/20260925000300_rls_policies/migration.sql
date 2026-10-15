-- Yene Verify — row-level security
-- The application role is yene_app. The migrator role has BYPASSRLS and is
-- never used for request traffic. TenantGuard sets these variables with SET
-- LOCAL inside the request transaction.

-- The tenant entity itself is scoped by its primary key.
ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "merchants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "merchants_tenant_isolation" ON "merchants";
CREATE POLICY "merchants_tenant_isolation" ON "merchants"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "id" = current_merchant_id())
  WITH CHECK (is_admin() OR "id" = current_merchant_id());

-- Tables with a direct merchant_id tenant column.
ALTER TABLE "sub_merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_merchants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_merchants_tenant_isolation" ON "sub_merchants";
CREATE POLICY "sub_merchants_tenant_isolation" ON "sub_merchants"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_tenant_isolation" ON "subscriptions";
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_transactions_tenant_isolation" ON "credit_transactions";
CREATE POLICY "credit_transactions_tenant_isolation" ON "credit_transactions"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "billing_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_verifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_verifications_tenant_isolation" ON "billing_verifications";
CREATE POLICY "billing_verifications_tenant_isolation" ON "billing_verifications"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipts_tenant_isolation" ON "receipts";
CREATE POLICY "receipts_tenant_isolation" ON "receipts"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verifications_tenant_isolation" ON "verifications";
CREATE POLICY "verifications_tenant_isolation" ON "verifications"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_tenant_isolation" ON "transactions";
CREATE POLICY "transactions_tenant_isolation" ON "transactions"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

ALTER TABLE "verification_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_reviews" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verification_reviews_tenant_isolation" ON "verification_reviews";
CREATE POLICY "verification_reviews_tenant_isolation" ON "verification_reviews"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

-- Notifications can be platform-level (merchant_id IS NULL); those rows are
-- admin-only. A merchant sees only rows belonging to its tenant.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_tenant_isolation" ON "notifications";
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  FOR ALL TO yene_app, yene_readonly
  USING (
    is_admin()
    OR ("merchant_id" IS NOT NULL AND "merchant_id" = current_merchant_id())
  )
  WITH CHECK (
    is_admin()
    OR ("merchant_id" IS NOT NULL AND "merchant_id" = current_merchant_id())
  );

ALTER TABLE "exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exports_tenant_isolation" ON "exports";
CREATE POLICY "exports_tenant_isolation" ON "exports"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

-- Audit rows with NULL merchant_id are platform-level and admin-only.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  FOR ALL TO yene_app, yene_readonly
  USING (
    is_admin()
    OR ("merchant_id" IS NOT NULL AND "merchant_id" = current_merchant_id())
  )
  WITH CHECK (
    is_admin()
    OR ("merchant_id" IS NOT NULL AND "merchant_id" = current_merchant_id())
  );

ALTER TABLE "analytics_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_snapshots" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_snapshots_tenant_isolation" ON "analytics_snapshots";
CREATE POLICY "analytics_snapshots_tenant_isolation" ON "analytics_snapshots"
  FOR ALL TO yene_app, yene_readonly
  USING (is_admin() OR "merchant_id" = current_merchant_id())
  WITH CHECK (is_admin() OR "merchant_id" = current_merchant_id());

-- Global tables intentionally have no RLS: users, otp_codes, packages,
-- duplicate_fingerprints, bank_reference_lookups, and feature_flags.
-- Their access rules are enforced by the service layer as documented in the
-- Step 5 tenancy design.
