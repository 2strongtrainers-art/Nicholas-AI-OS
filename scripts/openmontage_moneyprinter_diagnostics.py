#!/usr/bin/env python3
"""Add actionable diagnostics to MoneyPrinterTurbo CLI failures.

The sidecar originally used the shared worker runner with check=True, which
reduced a failed MoneyPrinter command to a generic non-zero exit status. This
wrapper only intercepts the MoneyPrinter CLI subprocess, captures its output,
redacts it with the worker's existing sanitizer, and raises a bounded error
containing the real provider/runtime failure. All other commands keep their
existing behavior.
"""

from __future__ import annotations

import openmontage_moneyprinter as moneyprinter


def install(worker) -> None:
    if getattr(moneyprinter, "_cli_diagnostics_installed", False):
        return

    original_run_moneyprinter = moneyprinter.run_moneyprinter
    cli_path = str(moneyprinter.MPT_DIR / "cli.py")

    def run_moneyprinter_with_diagnostics(
        worker_module,
        job: dict,
        job_id: str,
        project_id: str,
        timeout_seconds: int,
    ):
        original_worker_run = worker_module.run

        def diagnostic_run(cmd, cwd=None, timeout=None, check=True):
            is_moneyprinter_cli = any(str(part) == cli_path for part in cmd)
            if not is_moneyprinter_cli:
                return original_worker_run(
                    cmd,
                    cwd=cwd,
                    timeout=timeout,
                    check=check,
                )

            result = original_worker_run(
                cmd,
                cwd=cwd,
                timeout=timeout,
                check=False,
            )
            if result.returncode == 0:
                return result

            streams = []
            if result.stderr and result.stderr.strip():
                streams.append("STDERR:\n" + result.stderr.strip())
            if result.stdout and result.stdout.strip():
                streams.append("STDOUT:\n" + result.stdout.strip())
            raw_detail = "\n\n".join(streams) or "MoneyPrinter CLI returned no diagnostic output"
            detail = worker_module.sanitize_log_text(raw_detail)[-10000:]
            worker_module.log(
                f"MONEYPRINTER CLI EXIT {result.returncode} {job_id}: {detail}"
            )
            raise RuntimeError(
                f"MoneyPrinterTurbo CLI exit {result.returncode}: {detail}"
            )

        worker_module.run = diagnostic_run
        try:
            return original_run_moneyprinter(
                worker_module,
                job,
                job_id,
                project_id,
                timeout_seconds,
            )
        finally:
            worker_module.run = original_worker_run

    moneyprinter.run_moneyprinter = run_moneyprinter_with_diagnostics
    moneyprinter._cli_diagnostics_installed = True
