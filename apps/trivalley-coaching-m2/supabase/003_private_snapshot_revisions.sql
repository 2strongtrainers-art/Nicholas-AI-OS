-- TriValley Coaching staging: guarded recovery points, not off-provider backups.
-- No public or browser SQL access. Revisions are server-side only.
CREATE TABLE IF NOT EXISTS coaching_private.snapshot_revisions (
  org_id uuid NOT NULL REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision>=0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id,revision),
  CHECK (octet_length(payload::text)<4194304)
);
ALTER TABLE coaching_private.snapshot_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON coaching_private.snapshot_revisions FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO coaching_private.snapshot_revisions(org_id,revision,payload)
  SELECT org_id,revision,payload FROM coaching_private.snapshots
ON CONFLICT(org_id,revision) DO NOTHING;
