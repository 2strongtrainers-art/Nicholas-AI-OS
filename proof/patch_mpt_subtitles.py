#!/usr/bin/env python3
"""Preserve MoneyPrinter Whisper timing and SRT structure with text-only cleanup.

MoneyPrinterTurbo 1.3.5's subtitle.correct() can collapse unmatched script lines to
00:00:00 timestamps. For this pre-authored Reel, raw Whisper timing is useful and
must stay intact. This patch performs only in-place text replacements; it does not
split, re-index, remove, or rebuild SRT blocks.
"""
from pathlib import Path

path = Path("app/services/task.py")
text = path.read_text(encoding="utf-8")
old = '''        logger.info("\\n\\n## correcting subtitle")
        subtitle.correct(subtitle_file=subtitle_path, video_script=video_script)
'''
new = '''        logger.info("\\n\\n## preserving Whisper timings and SRT structure")
        subtitle_text = Path(subtitle_path).read_text(encoding="utf-8")
        replacements = {
            "threat in 50% tariffs": "threatened 50 percent tariffs",
            "threatened 50% tariffs": "threatened 50 percent tariffs",
            "beginning January 1 after": "beginning January first after",
            "Alibaba launched 1 3.0": "Alibaba launched Wan 3.0",
            "Alibaba launched 1-3.0": "Alibaba launched Wan 3.0",
            "Alabama launched 1 3.0": "Alibaba launched Wan 3.0",
            "Alabama launched 1-3.0": "Alibaba launched Wan 3.0",
            "Al-Ababa launched 1 3.0": "Alibaba launched Wan 3.0",
            "Al-Ababa launched 1-3.0": "Alibaba launched Wan 3.0",
            "about 4.\\n": "about 4.3\\n",
            "Tesla's": "Teslas",
            "that's the fast brief": "That's the fast brief",
        }
        for wrong, right in replacements.items():
            subtitle_text = subtitle_text.replace(wrong, right)
        Path(subtitle_path).write_text(subtitle_text, encoding="utf-8")
'''
if old not in text:
    raise SystemExit("MoneyPrinter subtitle correction block not found at pinned commit")
new = '        from pathlib import Path\n' + new
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched MoneyPrinter subtitle correction without changing SRT structure")
