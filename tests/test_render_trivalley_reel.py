import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from render_trivalley_reel import ffmpeg, load_edit, media_info, render


class ReelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.edit = {
            "episode_id": "elite-assessment-test",
            "segments": [
                {"clip": "movement.mp4", "seconds": 2.5, "caption": "Show me one rep."},
                {"clip": "movement.mp4", "start": 1, "seconds": 2.5,
                 "caption": "We start with a movement screen.", "narration": "voice.wav"},
            ],
            "end_card": {"seconds": 3},
        }

    def write_edit(self):
        (self.folder / "reel.json").write_text(json.dumps(self.edit), encoding="utf-8")

    def test_rejects_file_traversal(self):
        self.edit["segments"][0]["clip"] = "../movement.mp4"
        self.write_edit()
        with self.assertRaisesRegex(ValueError, "plain filename"):
            load_edit(self.folder)

    def test_rejects_negative_trim(self):
        (self.folder / "movement.mp4").touch()
        self.edit["segments"][0]["start"] = -1
        self.write_edit()
        with self.assertRaisesRegex(ValueError, "Clip start"):
            load_edit(self.folder)

    def test_end_to_end_h264_aac_reel_and_manifest(self):
        ffmpeg("-f", "lavfi", "-i", "testsrc2=size=432x768:rate=30", "-t", "4",
               "-c:v", "libx264", "-threads", "2", self.folder / "movement.mp4")
        ffmpeg("-f", "lavfi", "-i", "sine=frequency=440:duration=1.6",
               self.folder / "voice.wav")
        self.write_edit()
        output = self.folder / "review"
        render(self.folder, output)
        manifest = json.loads((output / "elite-assessment-test.manifest.json").read_text())
        self.assertEqual(manifest["qa"], "passed")
        self.assertAlmostEqual(manifest["seconds"], 8, delta=.1)
        self.assertRegex(manifest["sha256"], r"^[0-9a-f]{64}$")
        movie = output / manifest["file"]
        formats = {s["codec_name"] for s in media_info(movie)["streams"]}
        self.assertEqual(formats, {"h264", "aac"})
        contents = movie.read_bytes()
        self.assertLess(contents.index(b"moov"), contents.index(b"mdat"))

    def test_review_workflow_pilot_and_calendar(self):
        path = ROOT / "workflows/n8n/trivalley-reel-review.json"
        script = r"""
const assert = require('node:assert/strict');
const workflow = JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'));
const draft = workflow.nodes.find(x => x.name === 'Prepare the coaching episode');
const prepare = new Function('$input', draft.parameters.jsCode);
const run = value => prepare({first: () => ({json: value})});
assert.equal(run({})[0].json.episode_id, 'elite-assessment-pilot');
assert.match(run({})[0].json.caption, /\$297/);
assert.equal(run({})[0].json.review_status, 'draft');
assert.equal(workflow.settings.timezone, 'America/Los_Angeles');
assert.deepEqual(run({timestamp: '2026-11-16T07:59:59Z'}), []);
const mondays = [16, 23, 30].map(d => '2026-11-' + d).concat(['2026-12-07','2026-12-14','2026-12-21']);
for (const day of mondays) {
    const row = run({timestamp: day + 'T17:00:00Z'})[0].json;
    assert.equal(row.episode_id, 'show-me-one-rep-' + day);
    assert.equal(row.asset_status, 'awaiting_footage');
}
assert.deepEqual(run({timestamp: '2026-12-28T17:00:00Z'}), []);
assert.throws(() => run({timestamp: 'invalid'}));
assert.ok(workflow.nodes.some(x => x.parameters.operation === 'rowNotExists'));
assert.equal(workflow.active, false);
"""
        subprocess.run(["node", "-e", script, str(path)], check=True, timeout=15)


if __name__ == "__main__":
    unittest.main()
