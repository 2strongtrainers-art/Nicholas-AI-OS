"""Deterministic source-list tests, no external tool calls or private images."""
import json
from pathlib import Path
import unittest
REGISTRY=Path(__file__).resolve().parents[1]/"data/osint/screenshot-tool-screening-20261114.json"
class Screening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads(REGISTRY.read_text(encoding="utf-8"))
        cls.rows=cls.data["entries"]
    def test_count(self):
        self.assertEqual(len(self.rows),26)
        self.assertEqual(self.data["distinct_products"],25)
        self.assertEqual([x["screenshot_index"] for x in self.rows],list(range(1,27)))
        self.assertEqual(self.rows[-1]["duplicate_of"],20)
    def test_verified_exact_matches(self):
        self.assertEqual({x["name"] for x in self.rows if x["status"]=="verified_open_source"},{"ExifTool","MAT2","Exiv2"})
    def test_no_false_live_adapters(self):
        self.assertEqual(self.data["execution_status"],"research_only_no_new_runtime_adapters")
        self.assertTrue(all(x["status"]!="installed_in_ARGUS" for x in self.rows))
    def test_private_face_search_off(self):
        for x in self.rows:
            if x["name"].casefold() in {"facecheck.id","pimeyes"}:
                self.assertEqual(x["status"],"face_search_excluded")
if __name__=="__main__": unittest.main()
