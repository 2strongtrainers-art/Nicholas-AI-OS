#!/usr/bin/env python3
"""Read-only capability search over confirmed Tool Intelligence records."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tool_intelligence.registry import search_tools


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("query")
    parser.add_argument("--registry-dir", type=Path, default=ROOT / "data/tool-intelligence")
    args = parser.parse_args()
    print(json.dumps(search_tools(args.registry_dir, args.query), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
