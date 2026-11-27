-- Private coaching client-onboarding infrastructure.
-- All release gates are OFF. No real client data is inserted by this migration.
CREATE TABLE IF NOT EXISTS coaching_private.release_controls (
  org_id uuid PRIMARY KEY REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  enrollment_enabled boolean NOT NULL DEFAULT false,
  workout_sync_enabled boolean NOT NULL DEFAULT false,
  privacy_notice_version text NOT NULL DEFAULT 'DRAFT-2026-11-20',
  privacy_approved_at timestamptz,
  backup_verified_at timestamptz,
  reviewed_at timestamptz,
  CHECK (length(privacy_notice_version) BETWEEN 4 AND 70),
  CHECK (NOT enrollment_enabled OR (privacy_approved_at IS NOT NULL AND backup_verified_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS coaching_private.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  coach_id uuid NOT NULL,
  code_digest text NOT NULL UNIQUE CHECK (code_digest ~ '^[0-9a-f]{64}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','redeemed','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_member_id uuid,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '72 hours'),
  CHECK ((state='redeemed' AND claimed_at IS NOT NULL AND claimed_member_id IS NOT NULL)
     OR (state<>'redeemed' AND claimed_at IS NULL AND claimed_member_id IS NULL))
);
CREATE INDEX IF NOT EXISTS invitations_by_org ON coaching_private.invitations(org_id,coach_id,state,expires_at);
CREATE TABLE IF NOT EXISTS coaching_private.client_consents (
  wix_site_id uuid NOT NULL,
  wix_member_id uuid NOT NULL,
  org_id uuid NOT NULL REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  notice_version text NOT NULL CHECK (length(notice_version) BETWEEN 4 AND 70),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wix_site_id,wix_member_id),
  FOREIGN KEY (wix_site_id,wix_member_id)
    REFERENCES coaching_private.wix_memberships(wix_site_id,wix_member_id) ON DELETE RESTRICT
);
ALTER TABLE coaching_private.release_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_private.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_private.client_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON coaching_private.release_controls,coaching_private.invitations,coaching_private.client_consents
  FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO coaching_private.release_controls(org_id)
 SELECT id FROM coaching_private.organizations WHERE wix_site_id='9e6343d9-5a1c-45e2-8596-f73408e38402'::uuid
 ON CONFLICT DO NOTHING;