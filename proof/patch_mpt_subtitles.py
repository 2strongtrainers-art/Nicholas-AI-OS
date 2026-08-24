#!/usr/bin/env python3
"""Preserve MoneyPrinter Whisper timing while applying safe text-only cleanup.

MoneyPrinterTurbo 1.3.5's subtitle.correct() can collapse unmatched script lines to
00:00:00 timestamps. For this pre-authored Reel, raw Whisper timing is useful and
should be retained. This patch replaces only the spoken text of known variants and
removes isolated hallucinated one-word tail cues; it never changes timestamps.
"""
from pathlib import Path

path = Path("app/services/task.py")
text = path.read_text(encoding="utf-8")
old = '''        logger.info("\\n\\n## correcting subtitle")
        subtitle.correct(subtitle_file=subtitle_path, video_script=video_script)
'''
new = '''        logger.info("\\n\\n## preserving Whisper timings with safe text cleanup")
        subtitle_text = Path(subtitle_path).read_text(encoding="utf-8")
        replacements = {
            "The US threat in 50% tariffs on Canadian cars and trucks":
                "The U.S. threatened 50 percent tariffs on Canadian cars and trucks",
            "The US threatened 50% tariffs on Canadian cars and trucks":
                "The U.S. threatened 50 percent tariffs on Canadian cars and trucks",
            "beginning January 1 after trade talks broke down":
                "beginning January first after trade talks broke down",
            "Alibaba launched 1 3.0": "Alibaba launched Wan 3.0",
            "Alibaba launched 1-3.0": "Alibaba launched Wan 3.0",
            "Alabama launched 1 3.0": "Alibaba launched Wan 3.0",
            "Alabama launched 1-3.0": "Alibaba launched Wan 3.0",
            "including nearly 3 million Tesla's": "including nearly 3 million Teslas",
            "that's the fast brief": "That's the fast brief.",
        }
        for wrong, right in replacements.items():
            subtitle_text = subtitle_text.replace(wrong, right)
        subtitle_text = re.sub(r"\\babout 4\\.(?=\\s|$)", "about 4.3", subtitle_text)
        subtitle_blocks = []
        for block in subtitle_text.strip().split("\\n\\n"):
            lines = block.strip().splitlines()
            spoken = lines[-1].strip().lower().rstrip(".!?") if lines else ""
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
