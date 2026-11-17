-- TriValley FIT coaching M2 migration v001.
-- Design-only: NOT applied to any Wix site, Cloudflare D1, or production database.
-- Provider-specific encryption, IAM, audits, tenant isolation and transactional implementation must be approved.
PRAGMA foreign_keys = ON;

CREATE TABLE coaching_orgs (
  org_id TEXT NOT NULL PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE coaching_members (
  org_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coach','client')),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, member_id),
  FOREIGN KEY (org_id) REFERENCES coaching_orgs(org_id) ON DELETE RESTRICT
);

CREATE TABLE coaching_program_versions (
  org_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  coach_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL CHECK (state IN ('draft','published')),
  created_at TEXT NOT NULL,
  published_at TEXT,
  PRIMARY KEY (org_id, program_id, version),
  FOREIGN KEY (org_id, coach_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT
);

CREATE TABLE coaching_program_exercises (
  org_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  exercise_id TEXT NOT NULL,
  sets INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 12),
  reps INTEGER NOT NULL CHECK (reps BETWEEN 1 AND 60),
  rest_seconds INTEGER NOT NULL CHECK (rest_seconds BETWEEN 0 AND 600),
  tempo TEXT,
  coach_cue TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (org_id, program_id, version, ordinal),
  FOREIGN KEY (org_id, program_id, version)
    REFERENCES coaching_program_versions(org_id, program_id, version) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX coaching_program_exercise_once
  ON coaching_program_exercises(org_id, program_id, version, exercise_id);

CREATE TABLE coaching_assignments (
  org_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  program_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  assigned_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY (org_id, assignment_id),
  FOREIGN KEY (org_id, coach_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, client_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, program_id, program_version)
    REFERENCES coaching_program_versions(org_id, program_id, version) ON DELETE RESTRICT
);
CREATE INDEX coaching_assignments_coach
  ON coaching_assignments(org_id, coach_id, status, client_id);
CREATE INDEX coaching_assignments_client
  ON coaching_assignments(org_id, client_id, status);

CREATE TABLE coaching_workout_events (
  org_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
  payload_json TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (org_id, event_id),
  UNIQUE (org_id, client_id, session_id),
  FOREIGN KEY (org_id, client_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, assignment_id) REFERENCES coaching_assignments(org_id, assignment_id) ON DELETE RESTRICT
);
CREATE INDEX coaching_workout_history
  ON coaching_workout_events(org_id, client_id, performed_at);

CREATE TABLE coaching_checkins (
  org_id TEXT NOT NULL,
  checkin_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  client_event_id TEXT NOT NULL,
  week_of TEXT NOT NULL,
  completion_rating INTEGER NOT NULL CHECK (completion_rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  wants_review INTEGER NOT NULL CHECK (wants_review IN (0,1)),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','reviewed')),
  review_note TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  PRIMARY KEY (org_id, checkin_id),
  UNIQUE (org_id, client_id, client_event_id),
  FOREIGN KEY (org_id, assignment_id) REFERENCES coaching_assignments(org_id, assignment_id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, client_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT,
  FOREIGN KEY (org_id, coach_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT
);
CREATE INDEX coaching_checkin_queue
  ON coaching_checkins(org_id, coach_id, review_status, submitted_at);

CREATE TABLE coaching_deletion_requests (
  org_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_owner_review','approved','completed','rejected')),
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (org_id, request_id),
  UNIQUE (org_id, client_id, request_id),
  FOREIGN KEY (org_id, client_id) REFERENCES coaching_members(org_id, member_id) ON DELETE RESTRICT
);

CREATE TABLE coaching_audit_events (
  org_id TEXT NOT NULL,
  audit_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (org_id, audit_id)
);
CREATE INDEX coaching_audit_timestamp
  ON coaching_audit_events(org_id, occurred_at);
