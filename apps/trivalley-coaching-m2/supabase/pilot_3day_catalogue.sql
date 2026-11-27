-- Staging only: preload the exact 16 IDs from MUSCLE_SPLIT.days in the pinned OpenGym fork.
-- Source: apps/trivalley-opengym/tv-programs.mjs, feat/trivalley-opengym-free-20261116.
-- Do not create user workout records, client identities or automatic assignments.
-- Idempotent only on the pristine empty owner snapshot; if it is no longer pristine, stop for a human review.
UPDATE coaching_private.snapshots AS s
SET payload=jsonb_set(s.payload, '{exerciseCatalog}', '["2330","0861","0383","0294","0313","0289","0314","0405","0334","0200","0194","0739","1459","0586","0585","0605"]'::jsonb, true),
    revision=s.revision+1,
    updated_at=now()
FROM coaching_private.organizations AS o
WHERE s.org_id=o.id AND o.wix_site_id='9e6343d9-5a1c-45e2-8596-f73408e38402'::uuid
  AND s.revision=0
  AND s.payload->'exerciseCatalog'='[]'::jsonb
  AND s.payload->'programs'='[]'::jsonb
  AND s.payload->'assignments'='[]'::jsonb;
