#!/usr/bin/env python3
"""Stable entrypoint for the resilient Nicholas-AI-OS OpenMontage worker."""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import openmontage_worker_base as worker
import openmontage_worker_resilient as resilient
from openmontage_fast_reel_edl import install as install_fast_reel_edl
from openmontage_fast_reel_edl import normalize_clip_specs
from openmontage_moneyprinter import install as install_moneyprinter
from openmontage_moneyprinter_diagnostics import install as install_moneyprinter_diagnostics
from openmontage_moneyprinter_macos import install as install_moneyprinter_macos

# Re-export the routing helpers used by CI and by other lightweight callers.
classify_render_mode = worker.classify_render_mode
split_body_lines = worker.split_body_lines
build_fast_reel_props = worker.build_fast_reel_props

# Keep the proven resilient worker, add the deterministic multi-clip edit layer,
# repair MoneyPrinter's first-run macOS bootstrap, expose sanitized provider/CLI
# errors, then prefer MoneyPrinterTurbo as a safe sidecar. MoneyPrinter falls
# back to the already-installed EDL/Remotion path when fallback is enabled.
install_fast_reel_edl(resilient, worker)
install_moneyprinter_macos(worker)
install_moneyprinter_diagnostics(worker)
install_moneyprinter(resilient, worker)
main = resilient.main

if __name__ == "__main__":
    sys.exit(main())
