#!/usr/bin/env python3
"""Keep MoneyPrinter custom-audio captions fast on the Mac worker.

MoneyPrinterTurbo defaults to Whisper large-v3. That is appropriate for long
high-accuracy transcription, but it is excessive for a 15-90 second Fast Reel
whose exact script is already known. When the sidecar uses a prepared local
voiceover, preserve MoneyPrinter's Whisper subtitle path while selecting the
smaller `base` model for much lighter first-run download and CPU transcription.
"""

from __future__ import annotations

import openmontage_moneyprinter as moneyprinter


def install(worker) -> None:
    if getattr(moneyprinter, "_fast_whisper_installed", False):
        return

    original_sync = moneyprinter._sync_local_config

    def sync_fast_config(worker_module, provider: str, use_custom_audio: bool) -> None:
        original_sync(worker_module, provider, use_custom_audio)
        if not use_custom_audio:
            return

        config_path = moneyprinter.MPT_DIR / "config.toml"
        text = config_path.read_text(encoding="utf-8")
        text = moneyprinter._set_toml_assignment(text, "model_size", '"base"')
        config_path.write_text(text, encoding="utf-8")
        worker_module.log("MONEYPRINTER FAST CAPTIONS: whisper model_size=base")

    moneyprinter._sync_local_config = sync_fast_config
    moneyprinter._fast_whisper_installed = True
