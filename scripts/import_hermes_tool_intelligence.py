#!/usr/bin/env python3
"""Import structured Hermes LucasWebQ evidence into Tool Intelligence."""

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tool_intelligence.registry import import_hermes_evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT / "hermes/research/lucaswebq-parts-351-749-evidence.jsonl")
    parser.add_argument("--registry-dir", type=Path, default=ROOT / "data/tool-intelligence")
    args = parser.parse_args()
    print(json.dumps(asdict(import_hermes_evidence(args.source, args.registry_dir)), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
