#!/usr/bin/env python3
"""Preserve MoneyPrinter Whisper timing while applying safe text-only cleanup.

MoneyPrinterTurbo 1.3.5's subtitle.correct() can collapse unmatched script lines to
00:00:00 timestamps. For this pre-authored Reel, Whisper timing is already good,
so replace that correction call with narrow cleanup that never changes timing.
"""
from pathlib import Path

path = Path("app/services/task.py")
text = path.read_text(encoding="utf-8")
old = '''        logger.info("\\n\\n## correcting subtitle")
        subtitle.correct(subtitle_file=subtitle_path, video_script=video_script)
'''
new = '''        logger.info("\\n\\n## preserving Whisper timings with safe text cleanup")
        subtitle_text = Path(subtitle_path).read_text(encoding="utf-8")
        for wrong in (
            "Alibaba launched 1 3.0",
            "Alibaba launched 1-3.0",
            "Alabama launched 1 3.0",
            "Alabama launched 1-3.0",
        ):
            subtitle_text = subtitle_text.replace(wrong, "Alibaba launched Wan 3.0")
        subtitle_text = subtitle_text.replace("The US threat in 50%", "The US threatened 50%")
        subtitle_text = subtitle_text.replace("Tesla's", "Teslas")
        subtitle_text = re.sub(r"\\babout 4\\.(?=\\s|$)", "about 4.3", subtitle_text)
        subtitle_blocks = []
        for block in subtitle_text.strip().split("\\n\\n"):
            lines = block.strip().splitlines()
            spoken = lines[-1].strip().lower() if lines else ""
            if spoken in {"test", "fast"}:
                continue
            subtitle_blocks.append(block)
        Path(subtitle_path).write_text("\\n\\n".join(subtitle_blocks) + "\\n", encoding="utf-8")
'''
if old not in text:
    raise SystemExit("MoneyPrinter subtitle correction block not found at pinned commit")
new = '        from pathlib import Path\n' + new
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched MoneyPrinter subtitle correction to preserve Whisper timing")
