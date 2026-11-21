-- Owner-authorized private program publication; no client assignment, checkout, or outreach.
-- Source exact IDs and upper rep bounds: apps/trivalley-opengym/tv-programs.mjs.
DO $$
DECLARE
  owner_org uuid;
  prev_revision bigint;
  old_payload jsonb;
  new_payload jsonb;
  plan jsonb;
  ex jsonb;
  record jsonb;
  program_id text;
  now_stamp text := to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  program_entries jsonb := '[]'::jsonb;
  version_entries jsonb := '[]'::jsonb;
BEGIN
  SELECT org_id INTO owner_org FROM coaching_private.wix_memberships
  WHERE wix_site_id='9e6343d9-5a1c-45e2-8596-f73408e38402'::uuid
    AND wix_member_id='4d122d05-0633-461b-ab06-4c642199e75a'::uuid
    AND role='coach' AND status='active';
  IF owner_org IS NULL THEN RAISE EXCEPTION 'Canonical coach not provisioned'; END IF;
  SELECT payload,revision INTO old_payload,prev_revision FROM coaching_private.snapshots
    WHERE org_id=owner_org FOR UPDATE;
  IF old_payload IS NULL OR jsonb_array_length(old_payload->'programs')<>0
     OR jsonb_array_length(old_payload->'programVersions')<>0
     OR jsonb_array_length(old_payload->'assignments')<>0
     OR jsonb_array_length(old_payload->'exerciseCatalog')<>16
  THEN RAISE EXCEPTION 'Staging is not pristine; do not overwrite existing programs'; END IF;
  FOR plan IN SELECT value FROM jsonb_array_elements('[{"title":"Back & Biceps","description":"TriValley 3-Day Muscle Split: vertical and horizontal pulls, rear shoulders and curls. Private coaching template.","exercises":[{"exerciseId":"2330","sets":3,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0861","sets":3,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0383","sets":2,"reps":15,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0294","sets":3,"reps":12,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0313","sets":2,"reps":12,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."}]},{"title":"Chest & Triceps","description":"TriValley 3-Day Muscle Split: chest, shoulders and triceps. Private coaching template.","exercises":[{"exerciseId":"0289","sets":3,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0314","sets":3,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0405","sets":2,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0334","sets":2,"reps":15,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0200","sets":3,"reps":15,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0194","sets":2,"reps":15,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."}]},{"title":"Legs","description":"TriValley 3-Day Muscle Split: lower-body strength and posterior chain. Private coaching template.","exercises":[{"exerciseId":"0739","sets":3,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"1459","sets":3,"reps":12,"restSeconds":120,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0586","sets":3,"reps":15,"restSeconds":90,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0585","sets":2,"reps":15,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."},{"exerciseId":"0605","sets":3,"reps":15,"restSeconds":75,"tempo":null,"coachCue":"Keep 2–3 good reps in reserve; use controlled form."}]}]'::jsonb) LOOP
    FOR ex IN SELECT value FROM jsonb_array_elements(plan->'exercises') LOOP
      IF NOT (old_payload->'exerciseCatalog' ? (ex->>'exerciseId')) THEN
        RAISE EXCEPTION 'Unapproved exercise in program %',plan->>'title';
      END IF;
    END LOOP;
    program_id:=gen_random_uuid()::text;
    record:=jsonb_build_object(
      'id',program_id,'orgId',owner_org::text,
      'coachId','4d122d05-0633-461b-ab06-4c642199e75a',
      'title',plan->>'title','description',plan->>'description',
      'exercises',plan->'exercises','version',1,'status','published',
      'createdAt',now_stamp,'publishedAt',now_stamp
    );
    program_entries:=program_entries || jsonb_build_array(jsonb_build_array(program_id,record));
    version_entries:=version_entries || jsonb_build_array(jsonb_build_array(program_id||':1',record));
    INSERT INTO coaching_private.audit_events(org_id,actor_id,action,resource_id)
      VALUES (owner_org,'4d122d05-0633-461b-ab06-4c642199e75a','PROGRAM_CREATED',program_id),
             (owner_org,'4d122d05-0633-461b-ab06-4c642199e75a','PROGRAM_PUBLISHED',program_id||':1');
  END LOOP;
  new_payload:=jsonb_set(jsonb_set(old_payload,'{programs}',program_entries),'{programVersions}',version_entries);
  INSERT INTO coaching_private.snapshot_revisions(org_id,revision,payload) VALUES (owner_org,prev_revision,old_payload)
    ON CONFLICT(org_id,revision) DO NOTHING;
  UPDATE coaching_private.snapshots SET payload=new_payload,revision=revision+1,updated_at=now() WHERE org_id=owner_org;
  INSERT INTO coaching_private.snapshot_revisions(org_id,revision,payload)
    VALUES (owner_org,prev_revision+1,new_payload);
END $$;