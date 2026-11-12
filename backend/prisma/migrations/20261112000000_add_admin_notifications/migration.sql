-- v1.11.0 — admin broadcast history (Phase C)
--
-- One row per admin-composed notification. Per-recipient inbox rows live
-- in notifications and reference this id through data.adminNotificationId,
-- so delivery counts stay accurate as pushes settle asynchronously.

CREATE TYPE "admin_broadcast_target" AS ENUM ('ALL', 'ROLE', 'USER');

CREATE TABLE "admin_notifications" (
  "id" UUID PRIMARY KEY,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" VARCHAR(16) NOT NULL,
  "target_type" "admin_broadcast_target" NOT NULL,
  "target_role" "user_role",
  "target_user_id" UUID,
  "target_label" TEXT NOT NULL,
  "recipient_count" INTEGER NOT NULL,
  "sent_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX "admin_notifications_created_at_idx"
  ON "admin_notifications"("created_at" DESC);
