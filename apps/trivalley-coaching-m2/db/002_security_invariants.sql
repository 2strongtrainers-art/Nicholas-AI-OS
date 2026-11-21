-- Milestone 2 defense-in-depth (staging only; NOT applied to production).
-- SQLite / D1-compatible triggers preserve business integrity if an API
-- accidentally accepts a forged coach, client, or assignment relationship.
-- Requires 001_coaching_core.sql. Application-level authorization remains mandatory.

CREATE TRIGGER coaching_programs_coach_role
BEFORE INSERT ON coaching_program_versions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_members
    WHERE org_id=NEW.org_id AND member_id=NEW.coach_id
      AND role='coach' AND status='active'
  ) THEN RAISE(ABORT,'program coach must have active coach role') END;
END;

CREATE TRIGGER coaching_programs_published_immutable
BEFORE UPDATE ON coaching_program_versions
WHEN OLD.state='published'
BEGIN
  SELECT RAISE(ABORT,'published program version is immutable');
END;

CREATE TRIGGER coaching_program_exercises_draft_insert
BEFORE INSERT ON coaching_program_exercises
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_program_versions
    WHERE org_id=NEW.org_id AND program_id=NEW.program_id AND version=NEW.version
      AND state='draft'
  ) THEN RAISE(ABORT,'cannot change published program exercises') END;
END;

CREATE TRIGGER coaching_program_exercises_draft_update
BEFORE UPDATE ON coaching_program_exercises
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_program_versions
    WHERE org_id=OLD.org_id AND program_id=OLD.program_id AND version=OLD.version
      AND state='draft'
  ) THEN RAISE(ABORT,'cannot edit published program exercises') END;
END;

CREATE TRIGGER coaching_program_exercises_draft_delete
BEFORE DELETE ON coaching_program_exercises
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_program_versions
    WHERE org_id=OLD.org_id AND program_id=OLD.program_id AND version=OLD.version
      AND state='draft'
  ) THEN RAISE(ABORT,'cannot delete published program exercises') END;
END;

CREATE TRIGGER coaching_assignments_restrict
BEFORE INSERT ON coaching_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_members
    WHERE org_id=NEW.org_id AND member_id=NEW.coach_id AND role='coach' AND status='active'
  ) THEN RAISE(ABORT,'assignment requires active coach') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_members
    WHERE org_id=NEW.org_id AND member_id=NEW.client_id AND role='client' AND status='active'
  ) THEN RAISE(ABORT,'assignment requires active client') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_program_versions
    WHERE org_id=NEW.org_id AND program_id=NEW.program_id
      AND version=NEW.program_version AND coach_id=NEW.coach_id AND state='published'
  ) THEN RAISE(ABORT,'assigned program must be published by assigning coach') END;
END;

CREATE TRIGGER coaching_assignments_immutable_target
BEFORE UPDATE ON coaching_assignments
WHEN OLD.status='revoked' OR
  OLD.org_id!=NEW.org_id OR OLD.assignment_id!=NEW.assignment_id OR
  OLD.coach_id!=NEW.coach_id OR OLD.client_id!=NEW.client_id OR
  OLD.program_id!=NEW.program_id OR OLD.program_version!=NEW.program_version OR
  OLD.assigned_at!=NEW.assigned_at
BEGIN
  SELECT RAISE(ABORT,'assignment identity immutable or already revoked');
END;

CREATE TRIGGER coaching_workout_events_authorized_assignment
BEFORE INSERT ON coaching_workout_events
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_assignments
    WHERE org_id=NEW.org_id AND assignment_id=NEW.assignment_id
      AND client_id=NEW.client_id AND status='active'
  ) THEN RAISE(ABORT,'workout must belong to an active assigned client') END;
  SELECT CASE WHEN json_valid(NEW.payload_json)!=1
  THEN RAISE(ABORT,'workout payload must be JSON') END;
END;

CREATE TRIGGER coaching_workout_events_append_only
BEFORE UPDATE ON coaching_workout_events
BEGIN
  SELECT RAISE(ABORT,'completed workout event is append-only');
END;

CREATE TRIGGER coaching_checkins_authorized_assignment
BEFORE INSERT ON coaching_checkins
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coaching_assignments
    WHERE org_id=NEW.org_id AND assignment_id=NEW.assignment_id
      AND client_id=NEW.client_id AND coach_id=NEW.coach_id AND status='active'
  ) THEN RAISE(ABORT,'check-in must belong to an active assigned client and coach') END;
  SELECT CASE WHEN NEW.review_status!='pending' THEN
    RAISE(ABORT,'new check-in must start pending') END;
END;

CREATE TRIGGER coaching_checkins_review_once
BEFORE UPDATE ON coaching_checkins
WHEN OLD.review_status='reviewed' OR NEW.review_status!='reviewed' OR
   OLD.org_id!=NEW.org_id OR OLD.checkin_id!=NEW.checkin_id OR
   OLD.client_id!=NEW.client_id OR OLD.coach_id!=NEW.coach_id OR
   OLD.assignment_id!=NEW.assignment_id OR OLD.client_event_id!=NEW.client_event_id OR
   OLD.week_of!=NEW.week_of OR OLD.completion_rating!=NEW.completion_rating OR
   OLD.comment!=NEW.comment OR OLD.wants_review!=NEW.wants_review OR
   OLD.submitted_at!=NEW.submitted_at
BEGIN
  SELECT RAISE(ABORT,'check-in must be reviewed once without rewriting client feedback');
END;

CREATE TRIGGER coaching_audit_events_append_only
BEFORE UPDATE ON coaching_audit_events
BEGIN
  SELECT RAISE(ABORT,'audit events are append-only');
END;
