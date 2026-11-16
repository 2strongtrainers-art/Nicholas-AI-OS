#!/usr/bin/env python3
"""Install and verify selected optional research runtimes in a separate directory.

Python 3.12 and uv are required for setup. This is an opt-in local acceptance
helper, not a hosting service or a second tool router. Verification is offline
unless --public-cboe is explicitly supplied. It never provides model/broker keys,
starts a trading strategy, exposes a listening service, or registers a connector.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from urllib.request import urlopen

REPO = Path(__file__).resolve().parents[1]
RUNTIMES = ("openbb", "vibe", "scrapling")
VIBE_COMMIT = "29aa084fb7866087c612ddd55ef5449824374e22"
VIBE_URL = f"https://codeload.github.com/HKUDS/Vibe-Trading/tar.gz/{VIBE_COMMIT}"
VIBE_SHA256 = "c9cbb9d56b96ca376d13846929e139c9d6e20a08d60bf3cfcb266aa8f259eaa4"
TRANSPORT_ENV = {
    "PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT", "WINDIR",
    "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY",
    "https_proxy", "http_proxy", "all_proxy", "no_proxy",
    "REQUESTS_CA_BUNDLE", "SSL_CERT_FILE", "SSL_CERT_DIR",
}


def validate_root(value: str | Path) -> Path:
    root = Path(value).expanduser().resolve()
    # Never make the whole home/repository tree an allowed application-state area.
    for protected in (Path.home().resolve(), REPO):
        if protected == root or protected.is_relative_to(root):
            raise ValueError("runtime_root_must_be_a_dedicated_subdirectory")
    return root


def contained(root: Path, *parts: str) -> Path:
    target = root.joinpath(*parts).resolve()
    if not target.is_relative_to(root):
        raise ValueError("runtime_path_escaped_root")
    return target


def clean_environment(root: Path, name: str, source=None) -> dict[str, str]:
    source = os.environ if source is None else source
    env = {key: value for key, value in source.items() if key in TRANSPORT_ENV}
    state = contained(root, "state", name)
    env.update({
        "ALLOW_PAID_AI": "false", "ALLOW_APOLLO_CREDIT_SPEND": "false",
        "ALLOW_OUTBOUND_SEND": "false", "PYTHON_DOTENV_DISABLED": "1",
        "VIBE_TRADING_HOME": str(state), "VIBE_TRADING_ENABLE_SHELL_TOOLS": "false",
        "VIBE_TRADING_ENABLE_SCHEDULER": "false", "LANGCHAIN_TRACING_V2": "false",
        "OTEL_SDK_DISABLED": "true", "DO_NOT_TRACK": "1",
        "OPENBB_ALLOW_MUTABLE_EXTENSIONS": "false", "OPENBB_ALLOW_ON_COMMAND_OUTPUT": "false",
        "XDG_CONFIG_HOME": str(state / "config"), "XDG_CACHE_HOME": str(state / "cache"),
        "XDG_DATA_HOME": str(state / "data"), "MPLCONFIGDIR": str(state / "matplotlib"),
        "UV_CACHE_DIR": str(contained(root, "package-cache")), "UV_NO_CONFIG": "true",
        "UV_KEYRING_PROVIDER": "disabled", "UV_PYTHON_DOWNLOADS": "never",
        "PIP_CONFIG_FILE": os.devnull,
        "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
    })
    return env


def python_path(root: Path, name: str) -> Path:
    # Do not resolve the interpreter symlink: venv identity depends on its path.
    env = contained(root, "envs", name)
    return env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def setup(root: Path, name: str) -> None:
    if sys.version_info[:2] != (3, 12):
        raise RuntimeError("setup_requires_python_3_12")
    uv = shutil.which("uv")
    if not uv:
        raise RuntimeError("uv_not_installed")
    target = contained(root, "envs", name)
    if target.exists():
        raise RuntimeError("environment_exists_use_verify_or_choose_new_root")
    state = contained(root, "state", name)
    state.mkdir(parents=True, exist_ok=True)
    env = clean_environment(root, name)
    subprocess.run([uv, "venv", str(target), "--python", sys.executable, "--no-managed-python"],
                   env=env, cwd=state, check=True, timeout=60, capture_output=True)
    requirements = REPO / "requirements" / "optional-research" / f"{name}.txt"
    command = [uv, "pip", "install", "--python", str(python_path(root, name)),
               "--index-url", "https://pypi.org/simple", "--no-deps", "-r", str(requirements)]
    if name == "vibe":
        archive = contained(root, "downloads", f"vibe-trading-{VIBE_COMMIT}.tar.gz")
        archive.parent.mkdir(parents=True, exist_ok=True)
        # One ordinary HTTPS request; no retry, alternate fingerprint, or credentials.
        with urlopen(VIBE_URL, timeout=60) as response:
            if response.status != 200:
                raise RuntimeError("source_archive_http_error")
            data = response.read(100 * 1024 * 1024 + 1)
        if len(data) > 100 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != VIBE_SHA256:
            raise RuntimeError("source_archive_integrity_failed")
        archive.write_bytes(data)
        command.append(str(archive))
    subprocess.run(command, env=env, cwd=state, check=True, timeout=900, capture_output=True)
    print(json.dumps({"runtime": name, "status": "INSTALLED_UNVERIFIED", "hosted": False}))


def permitted_local_build_process(args, root: Path) -> bool:
    """Only OpenBB's local git-version probe and formatting of generated venv files."""
    executable, command, cwd, _env = args
    if not isinstance(command, (list, tuple)):
        return False
    if Path(executable).name == "git" and list(command[1:]) == ["rev-parse", "--is-inside-work-tree"]:
        return cwd is not None and Path(cwd).resolve().is_relative_to(root / "envs" / "openbb")
    if str(executable) != sys.executable or list(command[1:6]) != ["-m", "ruff", "check", "--fix-only", "--unsafe-fixes"]:
        return False
    files = list(command[6:])
    if files and files[0] == "--silent":
        files.pop(0)
    generated = root / "envs" / "openbb"
    return bool(files) and all(not str(p).startswith("-") and Path(p).resolve().is_relative_to(generated) for p in files)


def install_audit_guard(root: Path, *, public_network: bool) -> dict[str, int]:
    counts = {"private_read_attempts_blocked": 0, "network_attempts_blocked": 0,
              "process_attempts_blocked": 0, "local_build_processes_allowed": 0}
    private_home = Path.home().resolve()
    allowed = (root, REPO, Path(sys.prefix).resolve(), Path(sys.base_prefix).resolve())

    def protect(event, args):
        if event in ("socket.connect", "socket.getaddrinfo") and not public_network:
            counts["network_attempts_blocked"] += 1
            raise PermissionError("network_disabled_for_offline_verification")
        if event in ("subprocess.Popen", "os.system", "os.exec", "os.posix_spawn"):
            if event == "subprocess.Popen" and permitted_local_build_process(args, root):
                counts["local_build_processes_allowed"] += 1
                return
            counts["process_attempts_blocked"] += 1
            raise PermissionError("process_execution_disabled_for_verification")
        if event == "open" and isinstance(args[0], (str, bytes, os.PathLike)):
            path = Path(os.fsdecode(args[0])).resolve()
            if path.is_relative_to(private_home) and not any(path.is_relative_to(p) for p in allowed):
                counts["private_read_attempts_blocked"] += 1
                raise PermissionError("owner_state_access_refused")
    sys.addaudithook(protect)
    return counts


def check_openbb(state: Path, receipt: dict, public: bool) -> None:
    # Override only this process's app constants before importing obb; never change HOME.
    import openbb_core.app.constants as constants
    constants.HOME_DIRECTORY = state
    constants.OPENBB_DIRECTORY = state / "configuration"
    constants.USER_SETTINGS_PATH = constants.OPENBB_DIRECTORY / "user_settings.json"
    constants.SYSTEM_SETTINGS_PATH = constants.OPENBB_DIRECTORY / "system_settings.json"
    constants.OPENBB_DIRECTORY.mkdir(parents=True, exist_ok=True)
    constants.USER_SETTINGS_PATH.write_text(json.dumps({"credentials": {}, "preferences": {
        "data_directory": str(state / "data"), "cache_directory": str(state / "cache"),
        "export_directory": str(state / "exports"), "user_styles_directory": str(state / "styles"),
        "request_timeout": 20}, "defaults": {}}))
    constants.SYSTEM_SETTINGS_PATH.write_text(json.dumps({"logging_suppress": True,
        "logging_handlers": ["noop"], "python_settings": {"http": {"timeout": 20}}}))
    from openbb import obb
    from openbb_cboe.models.equity_historical import CboeEquityHistoricalFetcher as Fetcher
    receipt["versions"] = {p: importlib.metadata.version(p) for p in ("openbb-core", "openbb-cboe")}
    assert callable(obb.cboe.equity.historical), "missing_cboe_endpoint"
    query = Fetcher.transform_query({"symbol": "MSFT", "start_date": "2026-11-12", "end_date": "2026-11-13"})
    rows = Fetcher.transform_data(query, [{"symbol": "MSFT", "data": [
        {"date": "2026-11-13", "open": 100, "high": 102, "low": 99, "close": 101, "volume": 10},
        {"date": "2026-11-12", "open": 99, "high": 101, "low": 98, "close": 100, "volume": 20}]}])
    assert len(rows) == 2 and str(rows[0].date) == "2026-11-12" and rows[1].close == 101
    receipt.update(endpoint_available=True, offline_transform_verified=True,
                   validation_scope="installed Cboe endpoint and synthetic provider transform")
    if not public:
        receipt["public_history"] = "NOT_REQUESTED"
        return
    receipt["public_history"] = "ATTEMPTED_ONCE"
    output = obb.cboe.equity.historical(symbol="MSFT")
    frame = output.to_dataframe()
    assert {"open", "high", "low", "close", "volume"}.issubset(frame.columns)
    assert len(frame) >= 10 and frame.index.is_monotonic_increasing and frame.index.is_unique
    assert (frame[["open", "high", "low", "close"]] > 0).all().all()
    assert (frame["volume"] >= 0).all()
    receipt.update(public_history="VERIFIED", rows=len(frame),
                   first_date=str(frame.index[0])[:10], last_date=str(frame.index[-1])[:10])


def check_scrapling(receipt: dict) -> None:
    from scrapling.parser import Selector
    fixture = '<article data-id="1"><h2>Public research</h2><a href="https://example.org/">Source</a></article>'
    page = Selector(content=fixture)
    assert page.css("article h2::text").get() == "Public research"
    assert page.xpath("//article/@data-id").get() == "1"
    receipt.update(versions={"scrapling": importlib.metadata.version("scrapling")},
                   css_verified=True, xpath_verified=True, browser_installed=False,
                   validation_scope="installed parser with synthetic CSS and XPath fixture")


def mcp_json(value):
    if getattr(value, "is_error", False):
        raise RuntimeError("mcp_tool_failed")
    blocks = [b.text for b in value.content if getattr(b, "type", None) == "text"]
    if len(blocks) != 1:
        raise RuntimeError("unexpected_mcp_result")
    return json.loads(blocks[0])


async def check_vibe(receipt: dict) -> None:
    from fastmcp import Client
    import mcp_server
    async with Client(mcp_server.mcp) as client:
        catalog = await client.list_tools()
        names = {tool.name for tool in catalog}
        assert {"list_skills", "quantlib_call"}.issubset(names)
        assert not {"bash", "background_run", "cancel_background", "place_order", "cancel_order"} & names
        skills = mcp_json(await client.call_tool("list_skills", {}))
        assert isinstance(skills, list) and skills
        result = mcp_json(await client.call_tool("quantlib_call", {"action": "call", "module": "risk",
            "function": "historical_var", "kwargs": {
                "returns": [0.01, -0.02, 0.03, -0.04, 0.005], "confidence": 0.95}}))
        assert result.get("ok") is True and result.get("result") == 0.04
        receipt.update(versions={"vibe-trading-ai": importlib.metadata.version("vibe-trading-ai")},
            source_commit=VIBE_COMMIT, source_archive_sha256=VIBE_SHA256,
            mcp_tools=len(catalog), bundled_skills=len(skills), quantlib_result=result,
            validation_scope="in-process MCP protocol: tools/list, list_skills, pure quantlib_call")


def classify_error(exc: Exception) -> str:
    # No raw exceptions/headers/URLs/settings in the receipt.
    detail = str(exc)
    if "ClientConnectorDNSError" in detail or "Temporary failure in name resolution" in detail:
        return "public_provider_dns_unavailable"
    if isinstance(exc, PermissionError):
        return "verification_access_guard"
    if isinstance(exc, AssertionError):
        return "acceptance_assertion_failed"
    return "runtime_check_failed"


def verify_worker(root: Path, name: str, public: bool) -> int:
    state = contained(root, "state", name)
    state.mkdir(parents=True, exist_ok=True)
    receipt = {"runtime": name, "observed_at": datetime.now(timezone.utc).isoformat(),
               "python": sys.version.split()[0], "paid_calls": 0, "orders_sent": 0,
               "hosted": False, "mcp_registered_in_chatgpt": False, "public_network_enabled": public}
    counters = install_audit_guard(root, public_network=public)
    try:
        if name == "openbb":
            check_openbb(state, receipt, public)
        elif name == "vibe":
            asyncio.run(check_vibe(receipt))
        else:
            check_scrapling(receipt)
        receipt["status"] = "LOCAL_CHECKS_PASSED"
    except Exception as exc:
        receipt.update(status="BLOCKED", error_type=type(exc).__name__, error_code=classify_error(exc))
    receipt.update(counters)
    destination = contained(root, "receipts", f"{name}-{'public' if public else 'offline'}.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))
    return 0 if receipt["status"] == "LOCAL_CHECKS_PASSED" else 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("setup", "verify", "_verify_worker"))
    parser.add_argument("runtime", choices=RUNTIMES)
    parser.add_argument("--root", required=True, help="Dedicated runtime/state directory; no global installation")
    parser.add_argument("--public-cboe", action="store_true", help="One live OpenBB Cboe history attempt; never a paid provider")
    args = parser.parse_args(argv)
    if args.public_cboe and (args.runtime != "openbb" or args.action == "setup"):
        parser.error("--public-cboe is valid only for OpenBB verification")
    root = validate_root(args.root)
    try:
        if args.action == "setup":
            setup(root, args.runtime)
            return 0
        if args.action == "_verify_worker":
            return verify_worker(root, args.runtime, args.public_cboe)
        state = contained(root, "state", args.runtime)
        state.mkdir(parents=True, exist_ok=True)
        command = [str(python_path(root, args.runtime)), "-I", str(Path(__file__).resolve()),
                   "_verify_worker", args.runtime, "--root", str(root)]
        if args.public_cboe:
            command.append("--public-cboe")
        result = subprocess.run(command, env=clean_environment(root, args.runtime), cwd=state,
                                timeout=90, capture_output=True, text=True)
        # Only forward the structured receipt; dependency diagnostics remain out of logs.
        for line in reversed(result.stdout.splitlines()):
            if line.startswith('{"runtime":'):
                print(line)
                return result.returncode
        print(json.dumps({"runtime": args.runtime, "status": "BLOCKED", "error_code": "worker_no_receipt"}))
        return 1
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps({"runtime": args.runtime, "status": "BLOCKED", "error_type": type(exc).__name__,
                          "error_code": "setup_or_worker_failed"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
