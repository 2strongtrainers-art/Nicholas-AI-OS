-- One explicitly approved, exact Wix member alias for the coaching owner.
-- The primary 2strongtrainers member remains the canonical coach identity.
-- The 1strongtrainer Wix member may log in only with a real provider-verified member token.
CREATE TABLE IF NOT EXISTS coaching_private.owner_member_aliases (
  wix_site_id uuid NOT NULL,
  alias_member_id uuid NOT NULL,
  canonical_member_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(wix_site_id,alias_member_id),
  FOREIGN KEY(wix_site_id,canonical_member_id)
    REFERENCES coaching_private.wix_memberships(wix_site_id,wix_member_id)
    ON DELETE RESTRICT,
  CONSTRAINT distinct_login_and_canonical CHECK (alias_member_id <> canonical_member_id)
);
ALTER TABLE coaching_private.owner_member_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON coaching_private.owner_member_aliases FROM PUBLIC,anon,authenticated,service_role;
-- Only the two validated owner accounts are covered; nothing grants access to unknown accounts.
INSERT INTO coaching_private.owner_member_aliases
  (wix_site_id,alias_member_id,canonical_member_id,enabled)
SELECT m.wix_site_id, '856ae2b7-5fc4-42d5-9647-57ec7a4675f4'::uuid,
       m.wix_member_id, true
FROM coaching_private.wix_memberships m
WHERE m.wix_site_id='9e6343d9-5a1c-45e2-8596-f73408e38402'::uuid
  AND m.wix_member_id='4d122d05-0633-461b-ab06-4c642199e75a'::uuid
  AND m.role='coach' AND m.status='active'
ON CONFLICT(wix_site_id,alias_member_id) DO UPDATE
  SET enabled=EXCLUDED.enabled
  WHERE coaching_private.owner_member_aliases.canonical_member_id=EXCLUDED.canonical_member_id;