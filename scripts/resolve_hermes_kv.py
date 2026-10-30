#!/usr/bin/env python3
"""Build deployment config from an existing, unambiguous account KV namespace."""
import json
import re
import sys
from pathlib import Path


def resolve(config, rows):
    if not isinstance(rows, list):
        raise ValueError("Namespace list must be an array")
    names = {"HERMES_JOBS", f"{config['name']}-HERMES_JOBS"}
    matches = [r for r in rows if isinstance(r, dict) and r.get("title") in names]
    if not matches:
        raise LookupError("HERMES_JOBS namespace is missing")
    if len(matches) != 1:
        raise ValueError("Ambiguous HERMES_JOBS namespaces; resolve in the Cloudflare account before deployment")
    namespace_id = matches[0].get("id", "")
    if not isinstance(namespace_id, str) or not re.fullmatch(r"[a-fA-F0-9]{32}", namespace_id):
        raise ValueError("Invalid HERMES_JOBS namespace ID")
    config = dict(config)
    existing = config.get("kv_namespaces", [])
    config["kv_namespaces"] = [b for b in existing if b.get("binding") != "HERMES_JOBS"] + [
        {"binding": "HERMES_JOBS", "id": namespace_id}
    ]
    return config


def main():
    source, namespaces, output = map(Path, sys.argv[1:])
    try:
        config = resolve(json.loads(source.read_text()), json.loads(namespaces.read_text()))
        config["main"] = str((source.resolve().parent / config["main"]).resolve())
    except LookupError as exc:
        print(str(exc), file=sys.stderr)
        return 3
    except (ValueError, KeyError, TypeError) as exc:
        print(f"Cannot prepare Hermes deployment: {exc}", file=sys.stderr)
        return 1
    output.write_text(json.dumps(config, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
