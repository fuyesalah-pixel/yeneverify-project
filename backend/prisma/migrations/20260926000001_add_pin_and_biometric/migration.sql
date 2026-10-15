-- ============================================================
-- Yene Verify — PIN & Biometric Migration
-- Adds PIN hash, lockout tracking, and biometric flags to users.
-- Adds biometric flag to devices.
-- ============================================================

-- Users table: PIN & biometric columns
ALTER TABLE "users"
  ADD COLUMN "pin_hash" TEXT,
  ADD COLUMN "pin_set_at" TIMESTAMPTZ(6),
  ADD COLUMN "pin_failed_attempts" INT NOT NULL DEFAULT 0,
  ADD COLUMN "pin_locked_until" TIMESTAMPTZ(6),
  ADD COLUMN "biometric_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "biometric_enabled_at" TIMESTAMPTZ(6);

-- Index for reset jobs / admin queries on locked accounts
CREATE INDEX "users_pin_locked_until_idx" ON "users"("pin_locked_until") WHERE "pin_locked_until" IS NOT NULL;

-- Devices table: biometric flag per device
ALTER TABLE "devices"
  ADD COLUMN "biometric_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Partial index for active devices with biometric
CREATE INDEX "devices_biometric_enabled_idx" ON "devices"("biometric_enabled") WHERE "biometric_enabled" = true;