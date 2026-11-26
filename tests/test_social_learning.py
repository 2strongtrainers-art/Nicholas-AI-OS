import csv
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"scripts"))
from social_learning import process

COLUMNS = ["post_id", "platform", "post_url", "approved_at_pacific", "published_at_pacific", "reach", "saves", "shares", "qualified_applications", "booked_assessments", "approval_state", "evidence_status", "metrics_source", "metrics_as_of_pacific", "evidence_reference", "hook_variant"]


def row(post_id="A",platform="Instagram",reach="500",saves="12",shares="4",snapshot="2026-11-09T10:00:00-08:00"):
    return dict(post_id=post_id,platform=platform,post_url="https://instagram.com/p/"+post_id,
                approved_at_pacific="2026-11-01T09:00:00-08:00",published_at_pacific="2026-11-02T10:00:00-08:00",reach=reach,saves=saves,shares=shares,
                qualified_applications="",booked_assessments="",approval_state="OWNER_APPROVED",
                evidence_status="SOURCE_VERIFIED",metrics_source="owner_verified_export",metrics_as_of_pacific=snapshot,
                evidence_reference="owner-private-analytics-verified-"+post_id,hook_variant="A")

class LearningTests(unittest.TestCase):
    def check(self, rows):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"metrics.csv"
            with f.open("w",newline="") as h:
                w=csv.DictWriter(h,fieldnames=COLUMNS);w.writeheader();w.writerows(rows)
            return process(f,datetime(2026,11,17,12,0,tzinfo=ZoneInfo('America/Los_Angeles')))
    def test_blank_original_values_never_become_zero(self):
        x=self.check([dict.fromkeys(COLUMNS,"")]);self.assertEqual(x['rows_eligible'],0);self.assertEqual(x['proposals'],[])
    def test_no_receipt_or_owner_approval_rejects(self):
        a=row();a['approval_state']="";a['evidence_reference']=""
        x=self.check([a]);self.assertEqual(x['rows_eligible'],0);self.assertIn('NO_OWNER_APPROVAL_RECEIPT',x['reason_counts'])
    def test_same_platform_two_valid_make_tentative_not_auto_publish(self):
        x=self.check([row(),row(post_id="B",saves="3",shares="1")]);self.assertEqual(x['rows_eligible'],2)
        self.assertEqual(x['proposals'][0]['state'],'TENTATIVE_HYPOTHESIS_NOT_CAUSAL_LIFT')
        self.assertFalse(x['proposals'][0]['auto_publish'])
    def test_cannot_compare_cross_platform(self):
        x=self.check([row(),row(post_id="B",platform="Facebook")]);self.assertEqual(x['rows_eligible'],2);self.assertEqual(x['proposals'],[])
    def test_missing_saves_excluded_not_zero(self):
        x=self.check([row(saves="")]);self.assertEqual(x['rows_eligible'],0);self.assertIn('MISSING_SAVES_OR_SHARES',x['reason_counts'])
    def test_stale_snapshot_excluded(self):
        x=self.check([row(snapshot="2026-11-09T10:00:00-08:00")]);self.assertEqual(x['rows_eligible'],1)
        # a 7-day snapshot >14 days old should be rejected as stale on a later evaluation
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"metrics.csv"
            with f.open('w',newline='') as h:
                w=csv.DictWriter(h,fieldnames=COLUMNS);w.writeheader();w.writerow(row())
            y=process(f,datetime(2026,12,1,12,0,tzinfo=ZoneInfo('America/Los_Angeles')))
            self.assertEqual(y['rows_eligible'],0)
    def test_duplicate_post_platform_excluded(self):
        x=self.check([row(),row()]);self.assertEqual(x['rows_eligible'],1);self.assertIn('DUPLICATE_POST_PLATFORM',x['reason_counts'])
    def test_invalid_counts_excluded(self):
        x=self.check([row(reach="-1")]);self.assertEqual(x['rows_eligible'],0);self.assertIn('INVALID_METRIC_COUNT',x['reason_counts'])
    def test_never_claims_api_verification(self):
        x=self.check([row(),row(post_id="B")]);self.assertIn('no independent API verification',x['guardrails']['data_label'])

if __name__=='__main__':unittest.main()