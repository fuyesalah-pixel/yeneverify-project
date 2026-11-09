-- v1.9.2 — Google-first phone pairing
--
-- Adds phone_paired_at to users and a user_devices table for
-- device-account pairing (max 2 accounts per device).
-- Phone remains the primary identity; Google is the auth method.

ALTER TABLE "users" ADD COLUMN "phone_paired_at" TIMESTAMPTZ(6);

CREATE TABLE "user_devices" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_fingerprint" TEXT NOT NULL,
  "paired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_active_at" TIMESTAMPTZ(6)
);

CREATE INDEX "user_devices_fingerprint_idx" ON "user_devices"("device_fingerprint");
CREATE UNIQUE INDEX "user_devices_user_id_device_fingerprint_key" ON "user_devices"("user_id", "device_fingerprint");
