-- Additive defense in depth: PostgreSQL CHECK accepts UNKNOWN.
-- Require affirmative evidence, not NULL equality, for enabled enrollment.
-- Sync cannot be enabled independently of enrollment. No data, grants,
-- approval receipts, existing constraints or owner records are modified.
-- Preflight 2026-11-25: 16 read-only synthetic PostgreSQL predicates passed;
-- one existing release row is compatible and both release switches are OFF.
ALTER TABLE coaching_private.release_controls
  ADD CONSTRAINT release_controls_fail_closed_v2
  CHECK (
    ((NOT workout_sync_enabled OR enrollment_enabled)
     AND (NOT enrollment_enabled OR (
       privacy_approved_at IS NOT NULL
       AND enrollment_approved_at IS NOT NULL
       AND backup_verified_at IS NOT NULL
       AND restore_drill_at IS NOT NULL
       AND backup_revision IS NOT NULL
       AND backup_revision >= 0
       AND restore_drill_revision IS NOT NULL
       AND backup_revision = restore_drill_revision
       AND backup_file_sha256 IS NOT NULL
       AND restore_drill_sha256 IS NOT NULL
       AND backup_file_sha256 = restore_drill_sha256
     ))) IS TRUE
  );
