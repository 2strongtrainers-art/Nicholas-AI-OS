#!/usr/bin/env python3
"""macOS bootstrap repair for the MoneyPrinterTurbo Fast Reel sidecar.

MoneyPrinterTurbo's documented macOS/Linux install path explicitly installs a
managed Python 3.11 runtime with uv before running ``uv sync --frozen``. The
initial Nicholas-AI-OS sidecar installed uv but could attempt sync before that
runtime was present. This patch preserves the sidecar/fallback design while
following upstream's installation sequence exactly.
"""

from __future__ import annotations

from pathlib import Path

import openmontage_moneyprinter as moneyprinter


def _runtime_is_ready(worker, python_bin: Path) -> bool:
    if not python_bin.is_file():
        return False
    check = worker.run(
        [
            python_bin,
            "-c",
            "import moviepy, fastapi, loguru, requests; import app",
        ],
        cwd=moneyprinter.MPT_DIR,
        timeout=60,
        check=False,
    )
    return check.returncode == 0


def _run_uv_step(worker, bootstrap_python: Path, args: list[str], timeout: int) -> None:
    result = worker.run(
        [bootstrap_python, "-m", "uv", *args],
        cwd=moneyprinter.MPT_DIR,
        timeout=timeout,
        check=False,
    )
    if result.returncode == 0:
        return

    detail = worker.sanitize_log_text(
        (result.stderr or result.stdout or "uv command failed").strip()
    )[-5000:]
    worker.log(
        f"MONEYPRINTER UV STEP FAILED args={' '.join(args)} detail={detail}"
    )
    raise RuntimeError(
        f"MoneyPrinterTurbo uv {' '.join(args)} failed with exit "
        f"{result.returncode}: {detail}"
    )


def install(worker) -> None:
    """Patch MoneyPrinter's environment bootstrap once for macOS workers."""
    if getattr(moneyprinter, "_macos_bootstrap_repair_installed", False):
        return

    original = moneyprinter.ensure_moneyprinter

    def ensure_moneyprinter_macos(worker_module, auto_install: bool = True) -> Path:
        cli = moneyprinter.MPT_DIR / "cli.py"
        managed_python = moneyprinter.MPT_DIR / ".venv" / "bin" / "python"

        # A previous failed uv sync can still leave .venv/bin/python behind.
        # Verify imports instead of assuming that file means setup completed.
        if cli.is_file() and _runtime_is_ready(worker_module, managed_python):
            return managed_python

        if not auto_install:
            return original(worker_module, auto_install=False)

        # Let the original implementation handle the pinned clone/checkout when
        # this is a completely fresh Mac. It may also complete setup by itself.
        if not cli.is_file():
            try:
                candidate = original(worker_module, auto_install=True)
                if _runtime_is_ready(worker_module, candidate):
                    return candidate
            except Exception as exc:
                worker_module.log(
                    "MONEYPRINTER INITIAL BOOTSTRAP NEEDS MACOS REPAIR: "
                    + worker_module.sanitize_log_text(str(exc))
                )

        if not cli.is_file():
            raise RuntimeError("MoneyPrinterTurbo pinned checkout was not created")

        worker_module.log(
            "MONEYPRINTER MACOS REPAIR: installing uv-managed Python 3.11"
        )
        bootstrap_python = moneyprinter._bootstrap_uv(worker_module)

        # Upstream MoneyPrinterTurbo macOS/Linux instructions:
        #   uv python install 3.11
        #   uv sync --frozen
        _run_uv_step(
            worker_module,
            bootstrap_python,
            ["python", "install", "3.11"],
            timeout=600,
        )
        _run_uv_step(
            worker_module,
            bootstrap_python,
            ["sync", "--frozen"],
            timeout=1500,
        )

        if not _runtime_is_ready(worker_module, managed_python):
            raise RuntimeError(
                "MoneyPrinterTurbo uv sync completed but the managed runtime "
                "failed its import preflight"
            )

        worker_module.log("MONEYPRINTER MACOS REPAIR: runtime ready")
        return managed_python

    moneyprinter.ensure_moneyprinter = ensure_moneyprinter_macos
    moneyprinter._macos_bootstrap_repair_installed = True
