# Hermes Tool Intelligence and Node 24 Integration

## Source and policy

This integration uses the JSONL evidence produced by successful GitHub Actions run `33196596938` on branch `hermes/tool-intelligence-parallel`. The CSV is retained as a cross-check and the Hermes Markdown report as the policy/provenance narrative.

The importer processed Parts 683, 704, 731, 735, 736, 737, 741, 743, 744, 745, 746, 748, and 749. Results are deliberately separated:

- Confirmed (4), canonical: 683 MIT OpenCourseWare, 704 Yousician, 736 Dola AI, 743 StartMyCar.
- Probable (3), review only: 741 GrabCraft, 744 Coursera Plus, 749 Runable.
- Pending (6), evidence only: 731, 735, 737, 745, 746, 748.

Pending records contain no speculative website name or canonical URL. All imported API, MCP, and CLI fields remain `Unknown`; public website accessibility never creates a synthetic structured integration.

## Canonical architecture

No pre-existing canonical Tool Intelligence storage or importer was present on `origin/main`, so the smallest compatible subsystem was added:

- `data/tool-intelligence/canonical-tools.json`: confirmed tools available to routing.
- `data/tool-intelligence/probable-review.json`: mappings requiring human review.
- `data/tool-intelligence/pending-evidence.json`: unresolved research evidence.
- `scripts/import_hermes_tool_intelligence.py`: validated, deterministic, idempotent importer.
- `scripts/search_tool_intelligence.py`: read-only capability/name search over confirmed records only.
- `tool_intelligence/registry.py`: schema validation, URL/domain normalization, provenance, deduplication, confidence policy, and routing behavior.

Deduplication checks Lucas Part, video ID, Lucas source URL, canonical URL, normalized domain, and tool name. Existing extra/higher-quality fields and evidence sources are preserved when records are enriched.

## Node 24 Actions migration

All 22 workflow files under `.github/workflows` were inventoried. JavaScript actions were upgraded as follows while application Node remains 22:

- `actions/checkout@v4` to `actions/checkout@v5`
- `actions/setup-node@v4` to `actions/setup-node@v5`
- `actions/setup-python@v5` to `actions/setup-python@v6`
- `actions/github-script@v7` to `actions/github-script@v8`
- `actions/upload-artifact@v4` to `actions/upload-artifact@v6`

`QoderAI/qoder-action@v0` remains on its upstream tag after checking its official `action.yml`: it is a composite shell/npm action, not a JavaScript action with a GitHub-hosted Node runtime declaration. No `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` workaround was introduced.

## Validation record

- Importer run twice with identical `4/3/6` totals and no duplicates.
- Tool Intelligence unit tests cover exact Parts/URLs, confidence policy, unknown structured interfaces, stronger-record preservation, confirmed-only routing, and idempotency.
- All 22 workflow YAML files parsed successfully and the obsolete-pin/insecure-runtime scan passed.
- The self-hosted runner is v2.336.0 (newer than v2.327.1), its LaunchAgent is started, and GitHub reports it online for `2strongtrainers-art/Nicholas-AI-OS` with `self-hosted`, `macOS`, and `X64` labels. No upgrade was required.
- AI Switchboard TypeScript typecheck and Wrangler dry-run passed while retaining application Node 22. Live Ox, Qwen, and auto-route checks passed.
- OpenMontage regression tests and paper-trading safety tests passed; its tracked worker/config files remain intact.
- FCC v5.15.2, Codex CLI v0.149.1, and OpenCode v1.18.23 were verified against a temporary healthy local FCC proxy. Hermes remains callable at v0.20.5. The temporary proxy was stopped after verification.
