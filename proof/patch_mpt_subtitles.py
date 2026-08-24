#!/usr/bin/env python3
"""Preserve MoneyPrinter Whisper timing while applying safe text-only cleanup.

MoneyPrinterTurbo 1.3.5's subtitle.correct() can collapse unmatched script lines to
00:00:00 timestamps. For this pre-authored Reel, Whisper timing is already good,
so replace that correction call with a narrow cleanup that never changes timing.
"""
from pathlib import Path

path = Path("app/services/task.py")
text = path.read_text(encoding="utf-8")
old = '''        logger.info("\\n\\n## correcting subtitle")
        subtitle.correct(subtitle_file=subtitle_path, video_script=video_script)
'''
new = '''        logger.info("\\n\\n## preserving Whisper timings with safe text cleanup")
        subtitle_text = Path(subtitle_path).read_text(encoding="utf-8")
        subtitle_text = subtitle_text.replace("Alibaba launched 1 3.0", "Alibaba launched Wan 3.0")
        subtitle_text = subtitle_text.replace("about 4.", "about 4.3")
        subtitle_blocks = [
            block for block in subtitle_text.strip().split("\\n\\n")
            if not block.strip().lower().endswith("\\ntest")
        ]
        Path(subtitle_path).write_text("\\n\\n".join(subtitle_blocks) + "\\n", encoding="utf-8")
'''
if old not in text:
    raise SystemExit("MoneyPrinter subtitle correction block not found at pinned commit")
# task.py already imports Path-style path helpers but not pathlib.Path; add a local import.
new = '        from pathlib import Path\n' + new
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched MoneyPrinter subtitle correction to preserve Whisper timing")
