#!/usr/bin/env python3
"""macOS bootstrap repair for the MoneyPrinterTurbo Fast Reel sidecar.

MoneyPrinterTurbo's documented macOS/Linux install path explicitly installs a
managed Python 3.11 runtime with uv before running ``uv sync --frozen``. The
initial Nicholas-AI-OS sidecar installed uv but could attempt sync before that
runtime was present. This patch preserves the sidecar/fallback design while
following upstream's installation sequence exactly.

MoneyPrinterTurbo's current lock can also select an ONNX Runtime build that no
longer publishes a macOS x86_64 wheel. On Intel/Rosetta only, this module falls
back to MoneyPrinter's supported requirements.txt install path with a narrow
compatibility constraint for ONNX Runtime 1.23.2, which still publishes a
CPython 3.11 macOS x86_64 wheel.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import openmontage_moneyprinter as moneyprinter


X86_ONNX_CONSTRAINTS = "onnxruntime==1.23.2\nctranslate2==4.8.1\n"


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


def _run_uv_step(worker, bootstrap_python: Path, args: list[str], timeout: int):
    result = worker.run(
        [bootstrap_python, "-m", "uv", *args],
        cwd=moneyprinter.MPT_DIR,
        timeout=timeout,
        check=False,
    )
    if result.returncode == 0:
        return result

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


def _install_x86_compat_runtime(worker, bootstrap_python: Path, managed_python: Path) -> Path:
    worker.log(
        "MONEYPRINTER MACOS X86 COMPAT: rebuilding .venv with compatible ONNX Runtime"
    )
    venv_dir = moneyprinter.MPT_DIR / ".venv"
    if venv_dir.exists():
        shutil.rmtree(venv_dir)

    _run_uv_step(
        worker,
        bootstrap_python,
        ["venv", "--python", "3.11", ".venv"],
        timeout=300,
    )

    constraints = moneyprinter.MPT_DIR / ".nicholas-macos-x86-constraints.txt"
    constraints.write_text(X86_ONNX_CONSTRAINTS, encoding="utf-8")

    _run_uv_step(
        worker,
        bootstrap_python,
        [
            "pip",
            "install",
            "--python",
            str(managed_python),
            "-r",
            "requirements.txt",
            "--constraint",
            str(constraints),
        ],
        timeout=1800,
    )

    if not _runtime_is_ready(worker, managed_python):
        raise RuntimeError(
            "MoneyPrinterTurbo macOS x86 compatibility install completed but "
            "the managed runtime failed its import preflight"
        )
    worker.log("MONEYPRINTER MACOS X86 COMPAT: runtime ready")
    return managed_python


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
        try:
            _run_uv_step(
                worker_module,
                bootstrap_python,
                ["sync", "--frozen"],
                timeout=1500,
            )
        except RuntimeError as exc:
            detail = str(exc).lower()
            is_x86_onnx_gap = (
                "onnxruntime" in detail
                and "x86_64" in detail
                and "doesn't have a source distribution or wheel" in detail
            )
            if not is_x86_onnx_gap:
                raise
            return _install_x86_compat_runtime(
                worker_module,
                bootstrap_python,
                managed_python,
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
