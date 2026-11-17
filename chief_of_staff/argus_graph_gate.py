"""ARGUS -> graph integrity -> Chief of Staff evidence gate.

Input is OWNER-PRIVATE. Output is a sanitized status receipt and a normalized
Chief priority. Valid structural links are not verified claims or causation.
No network access, accounts, n8n calls, or publication.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from argus_event_graph import GraphIntegrityError, validate_graph

SCHEMA = "trivalley.argus-graph-gate.v1"
MAX_FILE_BYTES = 8_000_000
CODE_URL = (
    "https://github.com/2strongtrainers-art/Nicholas-AI-OS/"
    "blob/main/docs/ARGUS_EVENT_GRAPH_V1.md"
)


def timestamp(value):
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    raise ValueError("timezone-aware timestamp required")


def make_outputs(graph, *, as_of):
    """Return sanitized receipt and Chief-compatible snapshot; never certify claims."""
    metrics = validate_graph(graph)
    observed = timestamp(as_of)
    canonical = json.dumps(graph, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = sha256(canonical.encode("utf-8")).hexdigest()
    receipt = {
        "schema": SCHEMA,
        "status": "STRUCTURAL_PASS_REVIEW_REQUIRED",
        "validation": "referential_and_type_integrity_only",
        "input_sha256": digest,
        "case_cutoff": graph["cutoff"],
        "observed_at": observed,
        "metrics": metrics,
        "causal_links_certified": 0,
        "human_analyst_review": "not_observed",
        "chief_delivery": "normalized_output_prepared; acknowledgment_not_observed",
        "n8n_execution_id": None,
        "input_visibility": graph.get("visibility", "unspecified"),
        "limitations": [
            "Source citations do not independently verify attacks, casualties or attribution.",
            "Matching event tags do not establish causal connection or a common perpetrator.",
            "This offline receipt is not a live n8n execution or Chief acknowledgment.",
        ],
    }
    snapshot = {
        "run_id": "argusgraph-" + digest[:20] + "-" + as_of.strftime("%Y%m%d%H%M%S"),
        "as_of": observed,
        "coverage": {"github": "partial"},
        "items": [{
            "source": "github",
            "id": "argus-graph-structural-review",
            "version": "graph-v1-" + digest[:24],
            "title": "ARGUS graph structurally valid — human review required",
            "next_step": (
                "Review event accuracy, provenance and all candidate links; "
                "obtain actual authenticated n8n execution and Chief acknowledgment."
            ),
            "url": CODE_URL,
            "observed_at": observed,
            "due_at": None,
            "direction": "owner_action",
            "priority": "high",
        }],
    }
    return receipt, snapshot


def read_case(path):
    if path.stat().st_size > MAX_FILE_BYTES:
        raise GraphIntegrityError(["case exceeds 8 MB limit"])
    return json.loads(path.read_text(encoding="utf-8"))


def private_write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.is_symlink():
        raise ValueError("refuse to overwrite a symlink")
    data = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    fd = os.open(str(path), os.O_CREAT | os.O_TRUNC | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(data)
    except BaseException:
        try:
            os.close(fd)
        except OSError:
            pass
        raise


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", type=Path, help="local private ARGUS event graph JSON")
    p.add_argument("--receipt", type=Path, required=True, help="private status receipt JSON")
    p.add_argument("--chief-snapshot", type=Path, required=True, help="private normalized Chief snapshot JSON")
    args = p.parse_args(argv)
    if args.receipt.resolve() == args.input.resolve() or args.chief_snapshot.resolve() == args.input.resolve():
        print("BLOCKED: input cannot be an output path", file=sys.stderr)
        return 2
    try:
        doc = read_case(args.input)
        receipt, snapshot = make_outputs(doc, as_of=datetime.now(timezone.utc))
        private_write(args.receipt, receipt)
        private_write(args.chief_snapshot, snapshot)
    except (OSError, ValueError, GraphIntegrityError, json.JSONDecodeError) as error:
        print("BLOCKED: " + type(error).__name__, file=sys.stderr)
        return 1
    print("STRUCTURAL_PASS_REVIEW_REQUIRED: " + json.dumps(receipt["metrics"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
