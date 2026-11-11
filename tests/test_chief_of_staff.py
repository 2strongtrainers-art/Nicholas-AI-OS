import copy
import json
from pathlib import Path
import tempfile
import unittest

from chief_of_staff.brief import briefing


EXAMPLE = Path(__file__).resolve().parents[1] / "chief_of_staff/example.snapshot.json"


class ChiefOfStaffTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.state = Path(self.folder.name) / "chief-of-staff.sqlite"
        self.snapshot = json.loads(EXAMPLE.read_text())

    def run_brief(self, run_id, as_of=None):
        self.snapshot["run_id"] = run_id
        if as_of:
            self.snapshot["as_of"] = as_of
        return json.loads(briefing(self.snapshot, self.state))

    def test_identical_retry_replays_the_stored_brief(self):
        first = self.run_brief("first")
        self.assertEqual(first["priorities"][0]["urgency"], "due_soon")
        self.assertEqual(first["coverage"]["slack"], "unavailable")
        self.snapshot["items"].reverse()
        self.assertEqual(first, self.run_brief("first"))
        self.snapshot["items"][1]["title"] = "Changed"
        with self.assertRaisesRegex(ValueError, "already used"):
            self.run_brief("first")

    def test_unchanged_item_resurfaces_once_when_overdue(self):
        self.run_brief("first")
        self.assertFalse(self.run_brief("repeat", "2026-11-12T08:00:00-08:00")["priorities"])
        self.assertEqual(
            self.run_brief("later", "2026-11-12T12:30:00-08:00")["priorities"][0]["urgency"],
            "overdue",
        )
        self.assertFalse(self.run_brief("repeat-overdue", "2026-11-12T12:45:00-08:00")["priorities"])

    def test_new_evidence_resurfaces_item_and_stale_evidence_stays_suppressed(self):
        first_item = copy.deepcopy(self.snapshot["items"][0])
        self.run_brief("first")
        self.snapshot["items"][0].update(version="reply-3", observed_at="2026-11-12T03:10:00-08:00")
        changed = self.run_brief("changed", "2026-11-12T03:20:00-08:00")
        self.assertEqual(changed["priorities"][0]["version"], "reply-3")
        self.snapshot["items"][0] = first_item
        self.assertFalse(self.run_brief("stale", "2026-11-12T03:30:00-08:00")["priorities"])

    def test_conflicts_and_pacific_calendar_window(self):
        second = dict(self.snapshot["items"][1], id="overlap", due_at="2026-11-12T05:30:00-08:00",
                      end_at="2026-11-12T06:00:00-08:00")
        beyond = dict(second, id="after-tomorrow", due_at="2026-11-14T00:00:00-08:00",
                      end_at="2026-11-14T01:00:00-08:00")
        self.snapshot["items"].extend([second, beyond])
        brief = self.run_brief("first")
        self.assertEqual([item["id"] for item in brief["calendar"]], ["example-event", "overlap"])
        self.assertEqual(brief["calendar_conflicts"][0]["start_at"], "2026-11-12T13:30:00+00:00")
        self.assertEqual(brief["calendar_conflicts"][0]["end_at"], "2026-11-12T13:45:00+00:00")

    def test_unverified_sources_are_rejected(self):
        self.snapshot["items"][0]["url"] = "https://mail.google.com.example.org/thread"
        with self.assertRaisesRegex(ValueError, "approved domain"):
            self.run_brief("first")
        self.snapshot["items"][0]["url"] = "https://mail.google.com/mail/u/0/#all/example"
        self.snapshot["coverage"]["gmail"] = "unavailable"
        with self.assertRaisesRegex(ValueError, "coverage"):
            self.run_brief("first")
        self.assertFalse(self.state.exists())

    def test_does_not_reuse_state_files_with_broad_permissions(self):
        self.state.touch(mode=0o644)
        self.state.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "permissions"):
            self.run_brief("first")

    def test_rows_with_equal_identity_and_time_cannot_disagree(self):
        duplicate = dict(self.snapshot["items"][0], version="conflicting")
        self.snapshot["items"].append(duplicate)
        with self.assertRaisesRegex(ValueError, "Conflicting entries"):
            self.run_brief("first")


if __name__ == "__main__":
    unittest.main()
