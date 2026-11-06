-- v1.8.4 — QR detection hints on verifications
--
-- The mobile app scans the QR code printed on a receipt and submits
-- the raw payload alongside the receipt id. The payload is a HINT:
-- it can name the bank and carry a reference so the pipeline skips
-- OCR, but the verdict still comes from the bank adapter.
--
-- Both columns are nullable: receipts without a QR keep working and
-- the pipeline falls back to OCR.

ALTER TABLE "verifications" ADD COLUMN "qr_content" TEXT;
ALTER TABLE "verifications" ADD COLUMN "qr_type" TEXT;
