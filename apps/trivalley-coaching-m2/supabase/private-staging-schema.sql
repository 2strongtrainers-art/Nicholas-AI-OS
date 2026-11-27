-- TriValley Coaching: isolated zero-client staging database (PostgreSQL 17).
-- This is NOT the SQLite 001/002 draft; no public Data API grants.
-- Site binding is always the primary Wix Members Area site.
CREATE SCHEMA IF NOT EXISTS coaching_private;
REVOKE ALL ON SCHEMA coaching_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS coaching_private.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, wix_site_id)
);
CREATE TABLE IF NOT EXISTS coaching_private.wix_memberships (
  org_id uuid NOT NULL,
  wix_site_id uuid NOT NULL,
  wix_member_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('coach','client')),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('active','disabled')),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(wix_site_id, wix_member_id),
  FOREIGN KEY(org_id, wix_site_id) REFERENCES coaching_private.organizations(id,wix_site_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS wix_memberships_by_org ON coaching_private.wix_memberships(org_id,role,status);
CREATE TABLE IF NOT EXISTS coaching_private.snapshots (
  org_id uuid PRIMARY KEY REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
  payload jsonb NOT NULL DEFAULT '{"programs":[],"programVersions":[],"assignments":[],"workouts":[],"checkins":[],"deletionRequests":[],"exerciseCatalog":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload)='object'),
  CHECK (octet_length(payload::text)<4194304)
);
CREATE TABLE IF NOT EXISTS coaching_private.audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES coaching_private.organizations(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  resource_id text NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 180),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_by_org ON coaching_private.audit_events(org_id, occurred_at DESC);

ALTER TABLE coaching_private.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_private.wix_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_private.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_private.audit_events ENABLE ROW LEVEL SECURITY;
-- Defense in depth: no policies/grants for browser tokens, even for authenticated Supabase users.
REVOKE ALL ON ALL TABLES IN SCHEMA coaching_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA coaching_private FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA coaching_private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA coaching_private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;

-- Seed only an empty organization and a zero-client snapshot. No real identities or records.
INSERT INTO coaching_private.organizations(wix_site_id,display_name)
  VALUES ('9e6343d9-5a1c-45e2-8596-f73408e38402','TriValley.fit Coaching')
  ON CONFLICT(wix_site_id) DO NOTHING;
INSERT INTO coaching_private.snapshots(org_id)
  SELECT id FROM coaching_private.organizations
  WHERE wix_site_id='9e6343d9-5a1c-45e2-8596-f73408e38402'
  ON CONFLICT(org_id) DO NOTHING;