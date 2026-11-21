from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1] / "db"

class CoachingHardeningTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript((ROOT/"001_coaching_core.sql").read_text())
        self.db.executescript((ROOT/"002_security_invariants.sql").read_text())
        self.db.execute("INSERT INTO coaching_orgs VALUES ('org-a','Sample A','2026-11-17T00:00:00Z')")
        self.db.execute("INSERT INTO coaching_orgs VALUES ('org-b','Sample B','2026-11-17T00:00:00Z')")
        for org,id,role in [
            ('org-a','coach-a','coach'),('org-a','coach-b','coach'),
            ('org-a','client-a','client'),('org-a','client-b','client'),
            ('org-b','coach-x','coach'),('org-b','client-x','client')
        ]:
            self.db.execute(
                "INSERT INTO coaching_members(org_id,member_id,role,display_name,created_at) VALUES (?,?,?,?,?)",
                (org,id,role,id,'2026-11-17T00:00:00Z'))
        self.db.execute("""INSERT INTO coaching_program_versions
          (org_id,program_id,version,coach_id,title,state,created_at)
          VALUES ('org-a','prog-a',1,'coach-a','Sample','draft','2026-11-17T00:00:00Z')""")
        self.db.execute("""INSERT INTO coaching_program_exercises
          (org_id,program_id,version,ordinal,exercise_id,sets,reps,rest_seconds)
          VALUES ('org-a','prog-a',1,0,'bench',3,8,90)""")
        self.db.execute("""UPDATE coaching_program_versions SET state='published',
          published_at='2026-11-17T00:01:00Z' WHERE program_id='prog-a'""")
        self.db.execute("""INSERT INTO coaching_assignments
          (org_id,assignment_id,coach_id,client_id,program_id,program_version,status,assigned_at)
          VALUES ('org-a','assign-a','coach-a','client-a','prog-a',1,'active','2026-11-17T00:02:00Z')""")
    def tearDown(self):
        self.db.close()
    def assignment(self,assignment_id,coach,client,program='prog-a',version=1):
        return self.db.execute("""INSERT INTO coaching_assignments
          (org_id,assignment_id,coach_id,client_id,program_id,program_version,status,assigned_at)
          VALUES ('org-a',?,?,?,?,?,'active','2026-11-17T00:02:00Z')""",
          (assignment_id,coach,client,program,version))
    def workout(self,event_id,client='client-a',assignment='assign-a'):
        return self.db.execute("""INSERT INTO coaching_workout_events
          (org_id,event_id,client_id,assignment_id,session_id,payload_sha256,
           payload_json,performed_at,received_at)
          VALUES ('org-a',?,?,?,?,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
           '{}','2026-11-17T00:02:00Z','2026-11-17T00:04:00Z')""",
          (event_id,client,assignment,event_id))
    def checkin(self,checkin_id,client='client-a',coach='coach-a',assignment='assign-a'):
        return self.db.execute("""INSERT INTO coaching_checkins
          (org_id,checkin_id,client_id,assignment_id,coach_id,client_event_id,
           week_of,completion_rating,wants_review,submitted_at)
          VALUES ('org-a',?,?,?,?,?,'2026-11-16',4,1,'2026-11-17T00:05:00Z')""",
          (checkin_id,client,assignment,coach,checkin_id))
    def test_fake_coach_or_client_cannot_be_assigned(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.assignment('invalid-coach','client-b','client-a')
        with self.assertRaises(sqlite3.IntegrityError):
            self.assignment('invalid-client','coach-a','coach-b')
        with self.assertRaises(sqlite3.IntegrityError):
            self.assignment('wrong-owner','coach-b','client-a')
    def test_published_programs_are_immutable(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_program_versions SET title='Changed' WHERE program_id='prog-a'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_program_exercises SET reps=50 WHERE program_id='prog-a'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_program_exercises
              (org_id,program_id,version,ordinal,exercise_id,sets,reps,rest_seconds)
              VALUES ('org-a','prog-a',1,1,'row',3,10,60)""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM coaching_program_exercises WHERE program_id='prog-a'")
    def test_only_coaches_can_create_programs(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_program_versions
              (org_id,program_id,version,coach_id,title,state,created_at)
              VALUES ('org-a','invalid',1,'client-a','Fake','draft','2026-11-17T00:00:00Z')""")
    def test_workout_event_is_bound_to_exact_assigned_client(self):
        self.workout('good')
        with self.assertRaises(sqlite3.IntegrityError):
            self.workout('wrong',client='client-b')
        with self.assertRaises(sqlite3.IntegrityError):
            self.workout('forged',assignment='nonexistent')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_workout_events SET client_id='client-b' WHERE event_id='good'")
    def test_revocation_prevents_new_workouts_and_reactivation(self):
        self.db.execute("""UPDATE coaching_assignments SET status='revoked',
          revoked_at='2026-11-17T00:10:00Z' WHERE assignment_id='assign-a'""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.workout('revoked')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_assignments SET status='active' WHERE assignment_id='assign-a'")
    def test_assignment_target_cannot_be_changed_after_creation(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_assignments SET client_id='client-b' WHERE assignment_id='assign-a'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_assignments SET coach_id='coach-b' WHERE assignment_id='assign-a'")
    def test_checkin_must_use_client_and_coach_from_active_assignment(self):
        self.checkin('good')
        with self.assertRaises(sqlite3.IntegrityError):
            self.checkin('bad-client',client='client-b')
        with self.assertRaises(sqlite3.IntegrityError):
            self.checkin('bad-coach',coach='coach-b')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_checkins
              (org_id,checkin_id,client_id,assignment_id,coach_id,client_event_id,
               week_of,completion_rating,wants_review,review_status,submitted_at)
              VALUES ('org-a','pre-reviewed','client-a','assign-a','coach-a','event-x',
                '2026-11-16',4,1,'reviewed','2026-11-17T00:05:00Z')""")
    def test_checkin_review_cannot_rewrite_client_feedback(self):
        self.checkin('good')
        self.db.execute("""UPDATE coaching_checkins SET review_status='reviewed',
          review_note='Discuss coaching',reviewed_at='2026-11-17T00:06:00Z' WHERE checkin_id='good'""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_checkins SET comment='silently changed' WHERE checkin_id='good'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_checkins SET review_note='rewritten' WHERE checkin_id='good'")
    def test_audit_events_cannot_be_rewritten(self):
        self.db.execute("""INSERT INTO coaching_audit_events
          (org_id,audit_id,actor_id,action,resource_id,occurred_at)
          VALUES ('org-a','audit-1','coach-a','PROGRAM_ASSIGNED','assign-a','2026-11-17T00:03:00Z')""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE coaching_audit_events SET action='DELETE' WHERE audit_id='audit-1'")
    def test_invalid_workout_payload_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_workout_events
              (org_id,event_id,client_id,assignment_id,session_id,payload_sha256,
               payload_json,performed_at,received_at)
              VALUES ('org-a','bad-json','client-a','assign-a','bad-session',
               'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
               '{broken','2026-11-17T00:02:00Z','2026-11-17T00:04:00Z')""")

if __name__=='__main__':
    unittest.main()
