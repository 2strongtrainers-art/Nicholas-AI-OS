"""Regression checks for the opt-in research helper's account/cost boundaries."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/optional_research_runtime.py"
spec = importlib.util.spec_from_file_location("optional_research_runtime", SCRIPT)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class ResearchRuntimeSafetyTests(unittest.TestCase):
    def test_inherited_provider_credentials_and_paid_switches_are_removed(self):
        source = {"HOME": "/unchanged-home", "PATH": "/usr/bin", "OPENAI_API_KEY": "secret-model",
                  "APCA_API_KEY_ID": "secret-broker", "APCA_API_SECRET_KEY": "secret-broker-secret",
                  "QVERIS_API_KEY": "secret-data", "GITHUB_TOKEN": "secret-git",
                  "PYTHONPATH": "/untrusted/imports", "ALLOW_PAID_AI": "true",
                  "ALLOW_OUTBOUND_SEND": "true", "VIBE_TRADING_ENABLE_SHELL_TOOLS": "true"}
        with tempfile.TemporaryDirectory() as temporary:
            env = runtime.clean_environment(Path(temporary), "vibe", source)
        self.assertEqual(env["HOME"], source["HOME"])
        self.assertFalse(any("secret-" in value for value in env.values()))
        self.assertNotIn("PYTHONPATH", env)
        self.assertEqual(env["ALLOW_PAID_AI"], "false")
        self.assertEqual(env["ALLOW_OUTBOUND_SEND"], "false")
        self.assertEqual(env["VIBE_TRADING_ENABLE_SHELL_TOOLS"], "false")
        self.assertEqual(env["PYTHON_DOTENV_DISABLED"], "1")
        self.assertEqual(env["GIT_CONFIG_GLOBAL"], os.devnull)

    def test_whole_home_or_repository_cannot_be_an_allowed_state_root(self):
        for target in (Path.home(), runtime.REPO, Path("/")):
            with self.subTest(target=str(target)), self.assertRaises(ValueError):
                runtime.validate_root(target)

    def test_state_symlink_cannot_escape_root(self):
        with tempfile.TemporaryDirectory() as temporary, tempfile.TemporaryDirectory() as outside:
            root = Path(temporary)
            (root / "state").symlink_to(outside, target_is_directory=True)
            with self.assertRaises(ValueError):
                runtime.contained(root, "state", "vibe")

    def test_existing_environment_is_not_modified(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "envs/scrapling").mkdir(parents=True)
            with patch.object(runtime.shutil, "which", return_value="/usr/bin/uv"), \
                    patch.object(runtime.subprocess, "run") as process, \
                    patch.object(runtime, "urlopen") as network:
                with self.assertRaisesRegex(RuntimeError, "environment_exists"):
                    runtime.setup(root, "scrapling")
                process.assert_not_called()
                network.assert_not_called()

    def test_archive_integrity_failure_stops_before_package_install(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch.object(runtime.shutil, "which", return_value="/usr/bin/uv"), \
                    patch.object(runtime.subprocess, "run") as process, \
                    patch.object(runtime, "urlopen") as network:
                network.return_value.__enter__.return_value.status = 200
                network.return_value.__enter__.return_value.read.return_value = b"unexpected-source"
                with self.assertRaisesRegex(RuntimeError, "integrity_failed"):
                    runtime.setup(root, "vibe")
                self.assertEqual(process.call_count, 1)  # empty venv creation only
                self.assertEqual(network.call_count, 1)
                self.assertFalse(list(root.glob("downloads/*.tar.gz")))

    def test_public_flag_is_not_accepted_for_vibe_or_scrapling(self):
        for name in ("vibe", "scrapling"):
            with self.subTest(name=name), patch.object(runtime, "setup") as setup:
                with self.assertRaises(SystemExit) as raised:
                    runtime.main(["verify", name, "--root", "/tmp/research-test", "--public-cboe"])
                self.assertEqual(raised.exception.code, 2)
                setup.assert_not_called()

    def test_local_build_allowlist_cannot_run_arbitrary_commands_or_files(self):
        root = Path("/tmp/research-test")
        cwd = root / "envs/openbb/lib"
        self.assertTrue(runtime.permitted_local_build_process(
            ("/usr/bin/git", ["git", "rev-parse", "--is-inside-work-tree"], str(cwd), None), root))
        self.assertFalse(runtime.permitted_local_build_process(
            ("/usr/bin/git", ["git", "push"], str(cwd), None), root))
        self.assertFalse(runtime.permitted_local_build_process(
            ("/bin/sh", ["sh", "-c", "echo unsafe"], str(cwd), None), root))
        self.assertFalse(runtime.permitted_local_build_process(
            (sys.executable, [sys.executable, "-m", "ruff", "check", "--fix-only", "--unsafe-fixes", "/outside.py"], str(cwd), None), root))

    def test_offline_worker_blocks_network_private_state_and_child_process(self):
        # No file is created/read in the home directory and no socket can connect.
        child = """
import importlib.util,json,pathlib,socket,subprocess,sys
spec=importlib.util.spec_from_file_location('rt',sys.argv[1])
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
counts=m.install_audit_guard(pathlib.Path(sys.argv[2]),public_network=False)
for action in (
    lambda: socket.create_connection(('127.0.0.1',9),timeout=1),
    lambda: open(pathlib.Path.home()/'__research_probe_never_created__'),
    lambda: subprocess.run([sys.executable,'-c','raise SystemExit(99)'])):
    try: action()
    except PermissionError: pass
    else: raise AssertionError('guard_did_not_block')
print(json.dumps(counts))
"""
        with tempfile.TemporaryDirectory() as temporary:
            result = subprocess.run([sys.executable, "-I", "-c", child, str(SCRIPT), temporary],
                                    capture_output=True, text=True, timeout=10, check=True)
        counts = json.loads(result.stdout)
        self.assertEqual(counts["network_attempts_blocked"], 1)
        self.assertEqual(counts["private_read_attempts_blocked"], 1)
        self.assertEqual(counts["process_attempts_blocked"], 1)

    def test_receipt_error_classification_does_not_return_transport_or_secret_text(self):
        for exc in (RuntimeError("Authorization: secret-test"),
                    RuntimeError("ClientConnectorDNSError secret-test"),
                    PermissionError("secret-test")):
            self.assertNotIn("secret-test", runtime.classify_error(exc))


if __name__ == "__main__":
    unittest.main()
