-- Isolated database-copy verification gate before any real client pilot.
-- Store only non-sensitive attestation metadata. Decrypted payload is restored
-- solely into a transaction-local TEMP table ON COMMIT DROP.
ALTER TABLE coaching_private.release_controls
  ADD COLUMN IF NOT EXISTS restore_drill_at timestamptz,
  ADD COLUMN IF NOT EXISTS restore_drill_revision bigint,
  ADD COLUMN IF NOT EXISTS restore_drill_sha256 text;
ALTER TABLE coaching_private.release_controls
  ADD CONSTRAINT restore_drill_sha256_hex
  CHECK(restore_drill_sha256 IS NULL OR restore_drill_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE coaching_private.release_controls
  ADD CONSTRAINT activated_pilot_requires_restore
  CHECK(NOT enrollment_enabled OR
    (restore_drill_at IS NOT NULL AND restore_drill_revision IS NOT NULL
     AND backup_verified_at IS NOT NULL AND backup_revision=restore_drill_revision
     AND backup_file_sha256=restore_drill_sha256));
CREATE TABLE IF NOT EXISTS coaching_private.restore_drill_receipts(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  snapshot_revision bigint NOT NULL CHECK(snapshot_revision>=0),
  file_digest text NOT NULL CHECK(file_digest ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  program_count integer NOT NULL CHECK(program_count>=0),
  assignment_count integer NOT NULL CHECK(assignment_count>=0),
  workout_count integer NOT NULL CHECK(workout_count>=0),
  verified boolean NOT NULL CHECK(verified=true)
);
ALTER TABLE coaching_private.restore_drill_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON coaching_private.restore_drill_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS restore_drill_receipts_by_org
  ON coaching_private.restore_drill_receipts(org_id,verified_at DESC);