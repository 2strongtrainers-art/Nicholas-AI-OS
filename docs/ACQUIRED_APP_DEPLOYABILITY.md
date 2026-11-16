# Acquired applications: local acceptance and deployment requirements

Observed 2026-11-16. Prepared against `5b3097830118ae6ce8b794717e7bb3375a7f0b25`.
This is an operational readiness checklist and reproducible acceptance record,
not another routing registry. Use [capabilities.yaml](../capabilities.yaml) and
[WORKFLOW_ROUTER.md](../WORKFLOW_ROUTER.md) for task selection, [.gitmodules](../.gitmodules)
for attached source identities, and the existing [category inventory](../data/repo-portfolio/uploaded-screenshot-category-coverage-20261114.json)
and [acquisition report](../third_party/ai-tools-2026-10-15/README.md) for provenance.
Source acquisition, a component test, a local runtime, a hosted service and an
active assistant connector are separate states. Nothing in this document authorizes
real orders, model/data charges, outbound messages or new hosting resources.
Hermes is outside this work's scope.

## What can run now

| Selected runtime | Actual execution evidence | Remaining boundary |
|---|---|---|
| Vibe-Trading `0.1.16`, exact upstream commit `29aa084fb7866087c612ddd55ef5449824374e22` | Installed in an isolated Python 3.12 environment. A real in-process MCP client negotiated the server, listed **81 tool schemas**, read **90 bundled skills**, and called one pure `quantlib_call` operation: `risk.historical_var` returned `0.04` for the synthetic five-return fixture. No network/private-state attempts occurred. | This verifies those two tool calls and catalog access, not all 81 implementations. No live market fetch, model response, broker connector, persistent server, remote authentication or ChatGPT/Muse connector registration is established. |
| Scrapling `0.4.15` | Installed parser passed CSS and XPath fixtures. It also parsed an already-downloaded public HTTPS 200 HTML response; the receipt records its hash. A fresh environment created by the setup helper passed the parser check again. | Parser library only. Browser engines, stealth fetchers, crawling and MCP are neither installed nor activated by this helper. |
| OpenBB core `2.0.1` + Cboe `2.0.0` | Installed released packages, built the `obb.cboe.equity.historical` endpoint, and executed the actual provider's synthetic query/data transformation. | A public MSFT history read failed with `ClientConnectorDNSError` for `cdn.cboe.com`. No HTTP response was received. The environment/network problem remains unresolved; it is not proof of valid live bars. No alternate route or fingerprint was tried after diagnosis. |

Receipts: [Vibe offline](evidence/optional-research-20261116/vibe-offline.json),
[Scrapling offline](evidence/optional-research-20261116/scrapling-offline.json),
[Scrapling public HTML](evidence/optional-research-20261116/scrapling-public-html.json),
[OpenBB offline](evidence/optional-research-20261116/openbb-offline.json), and
[OpenBB public failure](evidence/optional-research-20261116/openbb-public-blocked.json).
All selected checks used zero provider keys, sent zero orders and made zero paid calls.
Local package installation and generated caches are the only intended writes.

## Reproduce the selected local checks

Use Python **3.12** and an existing installation of `uv` on an approved machine.
The dependency files freeze the versions actually installed on Linux; they are
not a promise of Windows/macOS compatibility or a full third-party security audit.
Vibe's source archive is commit-pinned and SHA256-checked. Its 183 runtime
dependencies, OpenBB's 45 packages and Scrapling's eight packages are separately
pinned. Package build tooling may still be supplied by the installer.

Choose a dedicated writable runtime directory outside the repository; do not
point it at the whole home directory or an existing application installation.
These commands download packages from official PyPI and Vibe's official GitHub
source. They do not install globally, start a public service or activate a schedule.

```sh
python3.12 scripts/optional_research_runtime.py setup scrapling --root /approved/path/research-runtime
python3.12 scripts/optional_research_runtime.py verify scrapling --root /approved/path/research-runtime

python3.12 scripts/optional_research_runtime.py setup vibe --root /approved/path/research-runtime
python3.12 scripts/optional_research_runtime.py verify vibe --root /approved/path/research-runtime

python3.12 scripts/optional_research_runtime.py setup openbb --root /approved/path/research-runtime
python3.12 scripts/optional_research_runtime.py verify openbb --root /approved/path/research-runtime
```

Setup refuses an existing environment rather than upgrading it implicitly.
Verification starts a child interpreter with provider/broker variables removed,
dotenv disabled, shell tools disabled, and all three repository cost/send switches
false. `HOME` remains unchanged; application settings and caches use the declared
runtime directory. OpenBB receives explicit empty credentials before import.
Offline checks reject network access and owner-state reads. The selected OpenBB
build may execute a bounded local Git version probe and format generated venv files;
other child-process attempts are blocked. These guards cover this acceptance
helper, not arbitrary future use of upstream programs or untrusted native code.

Each check writes a sanitized receipt under `ROOT/receipts/` and returns nonzero
on failure. It never writes raw settings, headers, response bodies or exception
messages into a receipt. A public Cboe read is a separate opt-in command:

```sh
python3.12 scripts/optional_research_runtime.py verify openbb --root /approved/path/research-runtime --public-cboe
```

Run that only on a host where the public provider is normally reachable and the
read is authorized. Do not repeatedly dispatch it against the known failing
environment, change fingerprints, bypass restrictions or substitute a paid feed.
The helper makes one history call per invocation and has no retry loop. A passing
offline receipt never becomes a passing live receipt by inference.

### Assistant access

Muse can use these commands only when its actual session exposes a permitted
executor on the machine containing the checkout and runtime. Giving it a GitHub
URL or instructions does not grant that executor. The Vibe verification uses an
in-process MCP transport and exits; it does not expose an HTTP/stdio connector to
another assistant. To make an always-available Vibe tool, select and approve the
host, configure an authenticated supported MCP transport from the pinned upstream
`agent/mcp_server.py`, register it separately in that assistant's supported client,
then verify the same selected tools there. Review the larger tool surface before
enabling it: optional QVeris/model/broker functions have separate prerequisites.
Keep shell tools and order execution disabled. A no-key local model path still
needs a running model service, licensed model weights and suitable hardware.

## Eleven attached AI/market repositories

All rows below are attached under
`third_party/ai-tools-2026-10-15/sources/<directory>`; the links identify the exact
reviewed upstream pin. They are upstream Git submodules, not eleven personal
forks or eleven deployed services. Initialize only the selected submodule:

```sh
git submodule update --init -- third_party/ai-tools-2026-10-15/sources/Lean
```

Review nested submodules separately. The older acquisition report remains the
source for historical tests; the dated evidence here adds narrower new runtime
proof without rewriting historical outcomes.

| Source directory / pinned upstream | Kind and evidence | Concrete requirements before broader deployment |
|---|---|---|
| `AutoHedge` — [The-Swarm-Corporation/AutoHedge](https://github.com/The-Swarm-Corporation/AutoHedge/tree/c549c7950da112286e76725d49f6a25de8fa99bd) | Autonomous trading source, MIT; 19 Python files parsed. No running strategy. | Review and lock dependencies; configure an approved research model. Its live Solana path requires Jupiter/provider setup and wallet signing material. No wallet/key import or real-order execution is part of this readiness work. |
| `Vibe-Trading` — [HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading/tree/29aa084fb7866087c612ddd55ef5449824374e22) | MIT; selected local MCP research checks now pass as above. Earlier 39 privacy/environment tests also passed. | A chosen persistent host/client and authenticated registration for shared service access. Models, paid QVeris data and profile-scoped broker reads each require their own supported setup. The 81-schema listing is not 81 function validations. |
| `FinceptTerminal` — [Fincept-Corporation/FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal/tree/3d8617cae3f13c93874d4bee4fb0f2846e9c83bc) | Desktop source; 1,156 Python files parsed, no GUI build. | Pinned build requirements include CMake 3.27.7, Ninja 1.11.1, Qt 6.8.3 and embedded Python 3.11.9. Review its [custom dual-license notice](https://github.com/Fincept-Corporation/FinceptTerminal/blob/3d8617cae3f13c93874d4bee4fb0f2846e9c83bc/LICENSE), including the stated commercial/internal-use requirements, before business use. Data and model providers remain separately licensed/configured. |
| `LibreChat` — [LibreChat-AI/LibreChat](https://github.com/LibreChat-AI/LibreChat/tree/e1dfc10449ff713faffacd60273fddcfe2c0a698) | MIT chat application; two translation tests, no running chat deployment. | Backend database/services, authentication, persistent storage, a chosen model endpoint and a host. An owned Ollama path can avoid model API charges, but no daemon/model is available here. Test a real chat round-trip before claiming working. |
| `Open-Generative-AI` — [Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI/tree/0668c210ebfe893f16c5149405a08d00b9ae90df) | MIT desktop/media application; 50 local-inference tests passed; legacy MiniMax registry-parser test failed. No media generation acceptance. | Nested submodules, desktop build, selected local inference engine/model and sufficient hardware. Remote MuAPI generation needs its own account/key and explicit cost authorization. No generated media or remote model call was made. |
| `Open-LLM-VTuber` — [Open-LLM-VTuber/Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/tree/992309c0aa19845960228f880013d4685fde93b5) | Voice/avatar desktop app source; 125 Python files parsed. | Frontend submodule, Python >=3.10,<3.13, audio/microphone runtime, ASR/TTS/LLM assets, and end-to-end voice/avatar check on the target machine. Review project and avatar-specific licenses. No target Mac/iPhone/audio device is provisioned by a Cloudflare token. |
| `agentic-inbox` — [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox/tree/48039bb6785af34e592c2966f87cde2b255c4c80) | Apache-2.0 cloud app; build/typecheck passed historically, no mail deployment acceptance. | Owned domain, Access policy, email routing/service, Durable Objects, R2, Workers AI and the corresponding account entitlements. Access members can reach all mailboxes by design; review that boundary. The currently scoped token for three existing Workers does not establish these new resources. Incoming/outgoing mail and AI calls need separate acceptance. |
| `camofox-browser` — [jo-inc/camofox-browser](https://github.com/jo-inc/camofox-browser/tree/39c82094013480b373df6600d44c7f036f58356e) | MIT browser infrastructure; initial unit results 853 pass/30 fail/2 skip, later cookie check passed after engine install; full browser rerun stalled. | Supported host/browser binaries and a bounded authorized browser integration test. No browser service accepted here. Do not use it to evade a site block or automate an account without the proper supported access. |
| `hyperframes` — [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes/tree/917ee5d31342f8c8a4a14659679762489cafe665) | Apache-2.0 rendering source. Later [PR 129](https://github.com/2strongtrainers-art/Nicholas-AI-OS/pull/129) records a local Hyperframes 0.8.162 H.264 1080×1920 eight-second render with zero audit findings. | That later local sample supersedes the older report's untested-render statement, but does not establish a hosted production service. Select a renderer host/toolchain and review/merge the sample separately; Bun is absent in this current environment. |
| `OpenBB` — [openbq-org/OpenBB](https://github.com/openbq-org/OpenBB/tree/e43353a82815ff9ba56ad1b7ad47c32729dcf314) | Apache-2.0 selected core/Cboe packages. Local installed-release endpoint and transform verified; live history DNS-blocked. | A normally reachable public Cboe endpoint to complete live read acceptance. The installed PyPI releases are recorded separately from the source pin; they are not asserted to be an exact checkout build. Other providers require their own accounts/terms; none is silently selected. |
| `Lean` — [QuantConnect/Lean](https://github.com/QuantConnect/Lean/tree/82d26047e95a89b53c9cbe02b67efaa3c4455ed9) | Apache-2.0 backtesting engine source only; no executed user backtest. | The pinned [README](https://github.com/QuantConnect/Lean/blob/82d26047e95a89b53c9cbe02b67efaa3c4455ed9/readme.md) offers a direct .NET 10 build/run or Docker/LEAN CLI route. Neither .NET nor Docker is installed here. Provision lawful historical data and run a deterministic fixture. Account/tier requirements depend on chosen data or hosted services; a paid QuantConnect account is not an inherent requirement of the standalone source engine. |

## Nick's original ten saved resources

These pins come from the saved `nick-repo-workflows` acquisition record. That
record and the source links establish acquisition, not a running server. Four
entries are directories and one is an examples collection; there is no meaningful
single service to deploy for those five. Directory licenses do not license the
vendors, datasets, models or code they list.

| Pinned upstream | Actual state / no-key usefulness | Remaining runtime or owner requirement |
|---|---|---|
| [public-apis/public-apis](https://github.com/public-apis/public-apis/tree/766854a4c350e6c61351e887205c9761b0aafb58) | MIT directory; acquired readable reference. | Select a particular API, verify its current endpoint/terms and configure that provider if needed. The directory itself needs no deployment. |
| [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers/tree/5c2e35ed712c636672a7d69a186f6d791f5cf66d) | MIT directory; acquired readable reference. | Select, review, install and register the specific MCP server in the actual client. Listing a server does not connect it. |
| [nexu-io/open-design](https://github.com/nexu-io/open-design/tree/70665d2b661443638c2419ac93cbac44975b23f2) | Apache-2.0 desktop application source; not installed/accepted on the target device. | Compatible target desktop/build, scoped project directory and configured supported model/media providers. Check target OS/architecture and any local model path; a template or design collection alone is not an app runtime. |
| [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps/tree/9848ec842c5f559ad42654288cc6a38db6b175fb) | Apache-2.0 examples collection; readable source. | Select one example, its dependencies, data inputs and model backend, then verify that example. There is no one all-examples production deployment. |
| [sindresorhus/awesome](https://github.com/sindresorhus/awesome/tree/bc98e517ddca672f55f9857d714fc3ea3c3540b2) | CC0-1.0 directory; readable reference. | No service installation required; independently review any selected downstream project. |
| [D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling/tree/28c329671485daaea89a40fb34a7db8622e51468) | BSD-3-Clause Python framework; release 0.4.15 parser executed successfully here. | Current helper is sufficient for local authorized HTML parsing. A browser/MCP/crawler deployment is a separate selected capability with target-site permission and host/browser requirements. |
| [ripienaar/free-for-dev](https://github.com/ripienaar/free-for-dev/tree/a7d416fef5b587cc4ae72057c1f89f9cb422e629) | Directory; readable reference, no service to start. | Review upstream directory terms and each chosen vendor's current allowance, account, billing and acceptable-use policy. A listed free tier is not an entitlement in the user's account. |
| [ollama/ollama](https://github.com/ollama/ollama/tree/9160b3c0b8c4539d23f93eed4ddb320510f63afa) | MIT model-runtime source; daemon not installed/running here. | Approved CPU/GPU host with sufficient RAM/storage, model-specific license and weights, then a real local response. This can avoid a metered model API; it does not create hardware or grant a session access to the owner's Mac. |
| [langflow-ai/langflow](https://github.com/langflow-ai/langflow/tree/e3abffc1b8da1e38cc2f21a9cf1b23b4a21c15d5) | MIT workflow-server source; no local/hosted flow accepted here. | Dedicated Python/service environment, authenticated access, persistent storage and selected components/model endpoint. A no-key local model requires its separately running service. Execute one complete flow before claiming deployment. |
| [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands/tree/c9b6ceac969573d9cd0ef8a8e61ddb3680679671) | MIT coding-agent source; no agent session accepted here. | Isolated execution host/runtime (commonly Docker), a scoped project mount and configured supported model. Docker is absent here. Never treat arbitrary access to the owner's entire home or credentials as an installation requirement. |

## Market Desk account boundary

The authoritative hosted job is [.github/workflows/market-desk-research.yml](../.github/workflows/market-desk-research.yml),
environment **`market-desk-research`** on `main`. It needs independently provisioned
**`APCA_API_KEY_ID`** and **`APCA_API_SECRET_KEY`**. Its strict hosted
[run 43744863330](https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/runs/43744863330)
failed for completed session `2026-11-13` with
`SKIPPED_NO_ALPACA_DATA_CREDENTIALS`, `orders_sent=0`. The earlier green run that
skipped credentials did not validate ingestion. Supplying the two data credentials
through the approved account/secret workflow and manually dispatching a completed
session is the remaining hosted acceptance action; this work did not create,
export or copy any broker key.

The connected ChatGPT Alpaca app exposes read-only market tools and its clock read
succeeded during this audit. A separate bounded native `get_stock_bars` request
for MSFT, `1Day`, IEX, `2026-11-13` and limit 1 returned an internal MCP error.
Clock access therefore does not prove current bar access. The connector exposes
no supported create/export-API-key operation. It cannot furnish hidden credentials
to GitHub Actions. A Cloudflare deployment token does not supply Alpaca credentials,
market-data entitlements or a working desktop runtime. The Unusual Whales read
previously returned `free_tier_upgrade_required`; no upgrade or paid request was made.

## Remaining reference families

The twelve `external_repositories` in [capabilities.yaml](../capabilities.yaml)
retain `reference_only_until_security_dependency_and_license_review`:
TencentCloud/TencentDB-Agent-Memory, opengeos/GeoLibre, 1jehuang/jcode,
lyogavin/airllm, ayghri/i-have-adhd, different-ai/openwork,
virgiliojr94/book-to-skill, microsoft/AI-For-Beginners,
boboidvtw/reverse-skill, lissy93/bug-bounties, mukul975/cve-mcp-server and
mukul975/Anthropic-Cybersecurity-Skills. They include learning/reference material,
not twelve accepted production applications. No installation or active security
test was undertaken for them here.

The ten OSINT gitlinks have their own canonical
[tool manifest](../services/osint-forensics/tool-manifest.json) and
[category handoff](REPOSITORY_UPLOAD_CATEGORY_DEPLOYMENT_HANDOFF_20261114.md).
Use the current ARGUS production receipt for live ExifTool evidence, not the older
handoff's deployment-pending wording. Signed C2PA acceptance and the other standalone
OSINT applications still need their particular fixture/runtime checks. ArchiveBox
remains disabled pending verified egress controls. This work neither uploads owner
evidence nor activates crawlers or face identification.

## Acceptance criteria for any next deployment

For a selected app, record the source pin and license decision, the concrete
host/runtime, the minimum account/secret references (never values), and one real
task result. Then test its actual authenticated interface from the assistant that
will use it. Call it hosted only after the persistent service is reachable and
call it integrated only after that assistant's selected operation succeeds.
Retain source-only or blocked states when the required owner account, hardware,
network reachability, license or supported connector is absent.
