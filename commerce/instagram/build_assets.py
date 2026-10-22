#!/usr/bin/env python3
"""Build original promotional SVG posts offline.

This is an offline build. It makes no claims about product demand or outcomes.
"""
import html
import json
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"


def build_social():
    content = json.loads((ROOT / "content.json").read_text())
    for number, item in enumerate(content, 1):
        headline = textwrap.wrap(item["headline"], 16)
        body = textwrap.wrap(item["body"], 33)
        lines = []
        for i, line in enumerate(headline):
            lines.append(f'<text x="86" y="{350+i*102}" class="headline">{html.escape(line)}</text>')
        for i, line in enumerate(body):
            lines.append(f'<text x="88" y="{700+i*57}" class="body">{html.escape(line)}</text>')
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title desc">
<title id="title">{html.escape(item['headline'])}</title><desc id="desc">{html.escape(item['body'])}</desc>
<style>.headline{{font:700 84px sans-serif;fill:#f5f3eb}}.body{{font:400 43px sans-serif;fill:#d3dedb}}</style>
<rect width="1080" height="1350" fill="#102a2b"/><path d="M760 0H1080V520Z" fill="#173c3d"/>
<rect x="88" y="126" width="80" height="9" fill="#dfad71"/>
<text x="88" y="202" fill="#dfad71" font-family="sans-serif" font-size="30" letter-spacing="5">TRIVALLEY.FIT</text>
{''.join(lines)}
<path d="M88 1126H992" stroke="#496162"/>
<text x="88" y="1198" fill="#dfad71" font-family="sans-serif" font-size="26" letter-spacing="3">CONSISTENCY SERIES</text>
<text x="990" y="1198" text-anchor="end" fill="#f5f3eb" font-family="sans-serif" font-size="30">{number:02d} / 07</text>
</svg>'''
        (ASSETS / (item["id"] + ".svg")).write_text(svg)



if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    build_social()
