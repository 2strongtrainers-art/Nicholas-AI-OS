-- Index the three foreign-key paths identified by Supabase's performance advisor.
CREATE INDEX IF NOT EXISTS client_consents_org_fk_idx
  ON coaching_private.client_consents(org_id);
CREATE INDEX IF NOT EXISTS owner_alias_canonical_fk_idx
  ON coaching_private.owner_member_aliases(wix_site_id,canonical_member_id);
CREATE INDEX IF NOT EXISTS wix_memberships_org_site_fk_idx
  ON coaching_private.wix_memberships(org_id,wix_site_id);