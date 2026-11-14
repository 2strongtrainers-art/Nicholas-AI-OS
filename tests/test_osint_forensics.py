"""Synthetic, zero-network safety tests: never use personal evidence in public CI."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

MODULE = Path(__file__).resolve().parents[1] / "services/osint-forensics/analyze.py"
SPEC = importlib.util.spec_from_file_location("argus_image_triage", MODULE)
triage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(triage)


class ImageTriageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "test.bin"
        self.path.write_bytes(b"ARGUS synthetic test\n")

    def test_sha256_is_repeatable_and_matches_original(self):
        import hashlib
        digest, size = triage.validated_sha256(self.path)
        self.assertEqual(digest, hashlib.sha256(self.path.read_bytes()).hexdigest())
        self.assertEqual(size, self.path.stat().st_size)

    def test_symlink_rejected(self):
        alias = Path(self.tmp.name) / "alias.bin"
        alias.symlink_to(self.path)
        with self.assertRaises(OSError):
            triage.validated_sha256(alias)

    def test_directory_rejected(self):
        with self.assertRaises(ValueError):
            triage.validated_sha256(Path(self.tmp.name))

    def test_over_limit_rejected_before_file_read(self):
        big = Path(self.tmp.name) / "big.bin"
        with big.open("wb") as stream:
            stream.truncate(triage.MAX_INPUT_BYTES + 1)
        with self.assertRaisesRegex(ValueError, "exceeds"):
            triage.validated_sha256(big)

    def test_exif_default_strips_unexpected_gps_even_if_parser_emits_it(self):
        response = {"status": "ok", "stdout": json.dumps([{
            "SourceFile": "/private/path.jpg",
            "EXIF:Make": "TestCamera",
            "EXIF:GPSLatitude": 37.5,
            "EXIF:SerialNumber": "PRIVATE",
            "File:MIMEType": "image/jpeg",
        }])}
        with mock.patch.object(triage, "invoke", return_value=response), \
             mock.patch.object(triage, "version", return_value="13.0"):
            result = triage.inspect_exif(self.path, False)
        self.assertEqual(result["status"], "ok")
        self.assertIn("EXIF:Make", result["metadata"])
        self.assertNotIn("EXIF:GPSLatitude", result["metadata"])
        self.assertNotIn("EXIF:SerialNumber", result["metadata"])
        self.assertNotIn("SourceFile", result["metadata"])

    def test_sensitive_mode_requires_explicit_flag(self):
        response = {"status": "ok", "stdout": json.dumps([{"GPS:GPSLatitude": 37.5}])}
        with mock.patch.object(triage, "invoke", return_value=response), \
             mock.patch.object(triage, "version", return_value="13.0"):
            default = triage.inspect_exif(self.path, False)
            allowed = triage.inspect_exif(self.path, True)
        self.assertNotIn("GPS:GPSLatitude", default["metadata"])
        self.assertEqual(allowed["metadata"]["GPS:GPSLatitude"], 37.5)

    def test_absent_tools_report_unavailable_not_success(self):
        with mock.patch.object(triage.shutil, "which", return_value=None):
            result = triage.analyze_file(self.path)
        self.assertEqual(result["tools"]["exiftool"]["status"], "unavailable")
        self.assertEqual(result["tools"]["c2patool"]["status"], "unavailable")
        self.assertFalse(result["sensitive_metadata_included"])

    def test_c2pa_manifest_does_not_claim_image_authenticity(self):
        response = {"status": "ok", "stdout": json.dumps({
            "active_manifest": "urn:uuid:test", "validation_state": "Valid",
            "validation_status": [],
        })}
        with mock.patch.object(triage, "invoke", return_value=response), \
             mock.patch.object(triage, "version", return_value="0.29.0"):
            result = triage.inspect_c2pa(self.path)
        self.assertTrue(result["manifest_reported"])
        self.assertEqual(result["validation_state_reported"], "Valid")
        self.assertIn("not proof", result["interpretation"])

    def test_nonjson_parser_output_fails_closed(self):
        with mock.patch.object(triage, "invoke", return_value={"status": "ok", "stdout": "<bad>"}):
            self.assertEqual(triage.inspect_exif(self.path, False)["status"], "failed")
            self.assertEqual(triage.inspect_c2pa(self.path)["status"], "failed")

    def test_report_is_private_and_cannot_overwrite(self):
        report = {"source_sha256": "synthetic", "tools": {}}
        destination = Path(self.tmp.name) / "report.json"
        triage.write_private_report(report, destination)
        self.assertEqual(json.loads(destination.read_text()), report)
        if os.name == "posix":
            self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(FileExistsError):
            triage.write_private_report({"overwrite": True}, destination)
        self.assertEqual(json.loads(destination.read_text()), report)

    def test_output_symlink_cannot_redirect_report(self):
        target = Path(self.tmp.name) / "target.txt"
        target.write_text("protected")
        alias = Path(self.tmp.name) / "report.json"
        alias.symlink_to(target)
        with self.assertRaises(OSError):
            triage.write_private_report({"secret": "should_not_write"}, alias)
        self.assertEqual(target.read_text(), "protected")


if __name__ == "__main__":
    unittest.main()
