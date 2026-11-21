-- Release-gate evidence: a locally decrypted, user-verified encrypted backup.
-- The owner holds the password and backup file. No secret or plaintext is stored here.
ALTER TABLE coaching_private.release_controls
  ADD COLUMN IF NOT EXISTS backup_revision bigint,
  ADD COLUMN IF NOT EXISTS backup_file_sha256 text,
  ADD COLUMN IF NOT EXISTS enrollment_approved_at timestamptz;
ALTER TABLE coaching_private.release_controls
  ADD CONSTRAINT backup_receipt_sha256_hex
  CHECK (backup_file_sha256 IS NULL OR backup_file_sha256 ~ '^[0-9a-f]{64}$');
UPDATE coaching_private.release_controls
SET privacy_notice_version='TVFIT-PILOT-2026-11-V1'
WHERE privacy_approved_at IS NULL AND privacy_notice_version='DRAFT-2026-11-20';
