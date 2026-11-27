from pathlib import Path
import sqlite3
import unittest

SCHEMA = Path(__file__).resolve().parents[1] / "db" / "001_coaching_core.sql"

class CoachingSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(SCHEMA.read_text())
        for org in ("org-a","org-b"):
            self.db.execute("INSERT INTO coaching_orgs(org_id,display_name,created_at) VALUES (?,?,?)", (org,org,"2026-11-17T15:00:00Z"))
        for org, member, role in (
            ("org-a","coach-a","coach"),("org-a","client-a","client"),
            ("org-a","client-b","client"),("org-b","coach-b","coach"),("org-b","client-x","client")
        ):
            self.db.execute(
                "INSERT INTO coaching_members(org_id,member_id,role,display_name,created_at) VALUES (?,?,?,?,?)",
                (org,member,role,member,"2026-11-17T15:00:00Z")
            )
        self.db.execute("""INSERT INTO coaching_program_versions
            (org_id,program_id,version,coach_id,title,state,created_at)
            VALUES ('org-a','program-a',1,'coach-a','Synthetic strength','published','2026-11-17T15:00:00Z')""")
        self.db.execute("""INSERT INTO coaching_assignments
            (org_id,assignment_id,coach_id,client_id,program_id,program_version,status,assigned_at)
            VALUES ('org-a','assign-a','coach-a','client-a','program-a',1,'active','2026-11-17T15:00:00Z')""")
    def tearDown(self):
        self.db.close()
    def test_foreign_org_cannot_reference_another_org_program(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_assignments
              (org_id,assignment_id,coach_id,client_id,program_id,program_version,status,assigned_at)
              VALUES ('org-b','wrong','coach-b','client-x','program-a',1,'active','2026-11-17T15:00:00Z')""")
    def test_program_version_is_part_of_foreign_key(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_assignments
              (org_id,assignment_id,coach_id,client_id,program_id,program_version,status,assigned_at)
              VALUES ('org-a','wrong','coach-a','client-a','program-a',99,'active','2026-11-17T15:00:00Z')""")
    def test_invalid_member_role_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO coaching_members
              (org_id,member_id,role,display_name,created_at)
              VALUES ('org-a','bad','admin','Bad','2026-11-17T15:00:00Z')""")
    def test_duplicate_replayed_workout_session_is_rejected(self):
        payload=("org-a","event-1","client-a","assign-a","session-1","a"*64,"{}","2026-11-17T15:00:00Z","2026-11-17T15:30:00Z")
        sql="""INSERT INTO coaching_workout_events
          (org_id,event_id,client_id,assignment_id,session_id,payload_sha256,payload_json,performed_at,received_at)
          VALUES (?,?,?,?,?,?,?,?,?)"""
        self.db.execute(sql,payload)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql,("org-a","event-2",*payload[2:]))
    def test_duplicate_program_exercise_ordinal_is_rejected(self):
        row=("org-a","program-a",1,0,"bench",3,8,90)
        sql="""INSERT INTO coaching_program_exercises
          (org_id,program_id,version,ordinal,exercise_id,sets,reps,rest_seconds) VALUES (?,?,?,?,?,?,?,?)"""
        self.db.execute(sql,row)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql,("org-a","program-a",1,1,"bench",3,8,90))
    def test_checkin_replay_and_rating_bounds(self):
        sql="""INSERT INTO coaching_checkins
        (org_id,checkin_id,client_id,assignment_id,coach_id,client_event_id,week_of,completion_rating,wants_review,submitted_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)"""
        args=("org-a","ck-1","client-a","assign-a","coach-a","offline-event-1","2026-11-16",4,1,"2026-11-17T15:30:00Z")
        self.db.execute(sql,args)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql,("org-a","ck-2",*args[2:]))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql,("org-a","ck-3",*args[2:7],12,1,args[-1]))
    def test_deletion_request_is_review_gated_not_implicit_delete(self):
        self.db.execute("""INSERT INTO coaching_deletion_requests
          (org_id,request_id,client_id,status,requested_at)
          VALUES ('org-a','request-1','client-a','pending_owner_review','2026-11-17T15:35:00Z')""")
        row=self.db.execute("SELECT status FROM coaching_deletion_requests WHERE request_id='request-1'").fetchone()
        self.assertEqual(row[0],"pending_owner_review")
        self.assertIsNotNone(self.db.execute("SELECT member_id FROM coaching_members WHERE member_id='client-a'").fetchone())

if __name__=='__main__':
    unittest.main()
