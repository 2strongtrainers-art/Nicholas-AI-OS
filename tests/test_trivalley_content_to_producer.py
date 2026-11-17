import unittest
from pathlib import Path
import tempfile,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from trivalley_content_to_producer import make_jobs,output_jobs
class Tests(unittest.TestCase):
 def seed(self):
  return {"owner_review_required":True,"auto_publish":False,"reels":[{"idea_id":"TV01","voiceover_script":"Example","shots":["front","side"]}],"plan":[{"id":"DAY01","date":"2026-11-17","format":"Reel","idea_id":"TV01","title":"Squat","cta":"Book $297 Elite Assessment"},{"id":"DAY02","date":"2026-11-18","format":"Carousel","idea_id":"TV02","title":"20-minute workout"}]}
 def test_approval_gates(self):
  jobs=make_jobs(self.seed(),2)
  self.assertEqual(len(jobs),2)
  self.assertTrue(jobs[0]["production"]["needs_real_footage"])
  self.assertIsNone(jobs[0]["production"]["video_wizard_clip_score"])
  self.assertFalse(jobs[0]["publication"]["auto_publish"])
  self.assertIn("Apply",jobs[0]["cta"])
 def test_no_autopublish(self):
  d=self.seed();d["auto_publish"]=True
  with self.assertRaises(ValueError):make_jobs(d)
 def test_summary(self):
  with tempfile.TemporaryDirectory() as d:
   result=output_jobs(make_jobs(self.seed()),d)
   self.assertEqual(result["paid_calls"],0)
   self.assertEqual(result["published"],0)
   self.assertTrue((Path(d)/"day01-reel.json").exists())
if __name__=="__main__":unittest.main()
