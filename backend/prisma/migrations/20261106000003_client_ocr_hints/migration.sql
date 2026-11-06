-- v1.8.5 — on-device (ML Kit) OCR hint on verifications
--
-- The mobile app runs ML Kit before upload and submits the recognized
-- text + confidence with the verification. The queue worker reads
-- these columns: when confidence clears the floor, the server skips
-- its OCR provider (Vision/Tesseract) entirely.
--
-- Client OCR is untrusted: detection, reference extraction and the
-- verdict still run server-side on the same text.

ALTER TABLE "verifications" ADD COLUMN "client_ocr_text" TEXT;
ALTER TABLE "verifications" ADD COLUMN "client_ocr_confidence" DECIMAL(4, 3);
