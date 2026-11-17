"""Build/check an INACTIVE synthetic-only n8n ARGUS graph->Chief staging workflow."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "workflows/n8n/argus-graph-chief-gate.json"


def build():
    code = (ROOT / "scripts/argus_graph_n8n_gate.js").read_text(encoding="utf-8")
    fixture = json.loads((ROOT / "tests/fixtures/argus-event-graph.synthetic.json").read_text(encoding="utf-8"))
    return {
        "name": "TriValley ARGUS Graph | Manual evidence gate to Chief (STAGING)",
        "active": False,
        "nodes": [
            {"id": "bed2eb99-0a1d-4ad3-9f51-1c73817c0001",
             "name": "Owner starts private graph review",
             "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1,
             "position": [120, 260], "parameters": {}},
            {"id": "bed2eb99-0a1d-4ad3-9f51-1c73817c0002",
             "name": "Synthetic graph packet — replace inside private workspace",
             "type": "n8n-nodes-base.set", "typeVersion": 3.4,
             "position": [400, 260],
             "parameters": {"mode": "raw",
                            "jsonOutput": json.dumps({"graph": fixture}, indent=2, ensure_ascii=False),
                            "options": {}}},
            {"id": "bed2eb99-0a1d-4ad3-9f51-1c73817c0003",
             "name": "Validate typed graph and create sanitized Chief packet",
             "type": "n8n-nodes-base.code", "typeVersion": 2,
             "position": [700, 260],
             "parameters": {"mode": "runOnceForAllItems", "jsCode": code}},
        ],
        "connections": {
            "Owner starts private graph review": {"main": [[{"node": "Synthetic graph packet — replace inside private workspace",
                                                        "type": "main", "index": 0}]]},
            "Synthetic graph packet — replace inside private workspace": {"main": [[{"node": "Validate typed graph and create sanitized Chief packet",
                                                                                        "type": "main", "index": 0}]]},
        },
        "settings": {"executionOrder": "v1", "timezone": "America/Los_Angeles",
                     "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all",
                     "saveManualExecutions": True},
        "pinData": {}, "tags": [],
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--check", action="store_true", help="fail if committed workflow drifts from source")
    args = p.parse_args()
    content = json.dumps(build(), indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != content:
            raise SystemExit("REJECTED: staged n8n workflow drifted from reviewed gate source")
        print("PASS: n8n graph workflow and JavaScript gate identical")
    else:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_text(content, encoding="utf-8")
        print("generated", TARGET)


if __name__ == "__main__":
    main()
