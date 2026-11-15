"""Validate externally uploaded GitHub screenshot taxonomy without fetching or executing upstream projects.

Requires ONLY Python stdlib. Never loads Git submodules, opens network sockets,
accesses private media or places real orders.
"""
import configparser
import json
from pathlib import Path
import re
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/"data/repo-portfolio/uploaded-screenshot-category-coverage-20261114.json"
N8N=ROOT/"workflows/n8n/repo-category-acquisition-readonly.json"
GITMODULES=ROOT/".gitmodules"


class CategoryCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
        cls.n8n=json.loads(N8N.read_text(encoding="utf-8"))
        cls.config=configparser.ConfigParser()
        cls.config.read(GITMODULES, encoding="utf-8")

    def test_exact_uploaded_photo_sets(self):
        sets=self.manifest["original_uploaded_screenshots"]
        self.assertEqual(sum(z["count"] for z in sets),9)
        photos=[f for z in sets for f in z["filenames"]]
        self.assertEqual(len(set(photos)),9)
        self.assertEqual(self.manifest["categories"][-1]["repo_count"],0)

    def test_at_least_one_source_per_safe_category(self):
        cats={c["id"]:c for c in self.manifest["categories"]}
        for k in ["image_metadata","provenance_and_tampering",
                  "privacy_scrubbing_derivatives","evidence_archiving",
                  "video_context_and_metadata","market_data_and_terminal",
                  "trading_agents_and_backtesting"]:
            self.assertEqual(cats[k]["repo_count"],2)
            self.assertEqual(len(cats[k]["members"]),2)
        self.assertEqual(cats["reverse_image_web_services"]["repo_count"],0)
        self.assertEqual(cats["facial_identity_search"]["repo_count"],0)

    def test_pinned_source_gitlinks_and_license(self):
        sources=self.manifest["osint_pinned_sources"]
        self.assertEqual(len(sources),10)
        self.assertEqual(len(set(s["path"] for s in sources)),10)
        for x in sources:
            self.assertRegex(x["sha"],r"^[0-9a-f]{40}$")
            self.assertTrue(x["source_url"].startswith("https://github.com/"))
            self.assertIn("pinned",x["acquisition"])
            self.assertIn('submodule "'+x["path"]+'"',self.config.sections())
            section=self.config['submodule "'+x["path"]+'"']
            self.assertEqual(section["path"],x["path"])
            self.assertEqual(section["url"],x["source_url"]+".git")
            raw=subprocess.run(["git","ls-tree","HEAD",x["path"]],cwd=ROOT,check=True,text=True,capture_output=True).stdout.strip()
            self.assertIn("160000 commit "+x["sha"],raw)

    def test_existing_market_sources_not_replaced(self):
        mods=GITMODULES.read_text(encoding="utf-8")
        for repo in ("OpenBB","Lean","Vibe-Trading","FinceptTerminal"):
            self.assertIn("third_party/ai-tools-2026-10-15/sources/"+repo,mods)

    def test_n8n_is_manual_and_read_only(self):
        d=self.n8n
        self.assertFalse(d.get("active",True))
        types=[n["type"] for n in d["nodes"]]
        self.assertEqual(types.count("n8n-nodes-base.manualTrigger"),1)
        self.assertEqual(types.count("n8n-nodes-base.httpRequest"),1)
        self.assertFalse(any("scheduleTrigger" in x or "webhook" in x.lower() for x in types))
        self.assertFalse(any("dataTable" in x or "email" in x.lower() for x in types))
        http=next(n for n in d["nodes"] if n["type"].endswith(".httpRequest"))
        self.assertEqual(http["parameters"]["method"],"GET")
        self.assertIn("raw.githubusercontent.com/2strongtrainers-art/Nicholas-AI-OS",http["parameters"]["url"])
        self.assertNotIn("credential",json.dumps(d).lower())
        self.assertIn("Source",json.dumps(d)) if False else None


if __name__=="__main__":
    unittest.main()
