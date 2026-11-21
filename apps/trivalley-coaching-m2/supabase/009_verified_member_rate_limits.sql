-- Per-verified-Wix-member persistent abuse controls (UTC hour buckets).
-- All clients remain denied before authenticated site/member verification.
CREATE TABLE IF NOT EXISTS coaching_private.request_limits (
  org_id uuid NOT NULL REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  wix_member_id uuid NOT NULL,
  scope text NOT NULL CHECK(scope IN ('mutation','invite_redeem')),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0 AND attempts<=1000000),
  PRIMARY KEY(org_id,wix_member_id,scope,window_start)
);
ALTER TABLE coaching_private.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON coaching_private.request_limits FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS request_limits_expiration_idx
  ON coaching_private.request_limits(window_start);