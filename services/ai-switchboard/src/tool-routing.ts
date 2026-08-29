import shard01 from "./catalog/websurfers-01.txt";
import shard02 from "./catalog/websurfers-02.txt";
import shard03 from "./catalog/websurfers-03.txt";
import shard04 from "./catalog/websurfers-04.txt";
import shard05 from "./catalog/websurfers-05.txt";
import shard06 from "./catalog/websurfers-06.txt";
import shard07 from "./catalog/websurfers-07.txt";
import shard08 from "./catalog/websurfers-08.txt";

export interface ToolRoutingEnv {
  TOOL_ROUTER_URL?: string;
  TOOL_ROUTER_SHARED_SECRET?: string;
}

type RouteBody = {
  task?: string;
  runtime_adapters?: string[];
  limit?: number;
  include_paid?: boolean;
};

type PublicToolResult = {
  score?: number;
  mode?: string;
  can_execute_now?: boolean;
  tool_id?: string;
  website_name?: string;
  canonical_url?: string;
  domain?: string;
  category?: string;
  subcategory?: string;
  pricing?: string;
  direct_connector?: string | null;
  runtime_adapter_live?: boolean;
  reason?: unknown;
  lucas_confirmed_parts?: unknown;
  lucas_review_only_parts?: unknown;
};

type CompactRegistry = {
  v: number;
  cats: string[];
  subs: Array<string | null>;
  login: Record<string, number>;
  tools: Array<[string, string, number, number, number, string[], number]>;
};

type CatalogTool = {
  tool_id: string;
  website_name: string;
  canonical_url: string;
  domain: string;
  category: string;
  subcategory: string;
  pricing: "free" | "freemium" | "paid" | "unknown";
  keywords: string[];
  login: "not_required_claimed" | "required_claimed" | "unknown";
  direct_connector: string | null;
};

const CATALOG_B64 = [shard01, shard02, shard03, shard04, shard05, shard06, shard07, shard08].join("").replace(/\s+/g, "");
const PRICES: CatalogTool["pricing"][] = ["free", "freemium", "paid", "unknown"];
let catalogPromise: Promise<CatalogTool[]> | undefined;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "get",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "show", "that", "the",
  "this", "to", "tool", "tools", "use", "using", "want", "with", "you", "your", "find", "need", "make",
]);

const CONSTRAINTS = new Set(["free", "no-cost", "browser", "online", "web-based", "api", "mcp", "cli"]);
const NON_ENTITY_ACRONYMS = new Set(["ai", "api", "mcp", "cli", "ui", "ux"]);
const ALIASES: Record<string, string[]> = {
  car: ["vehicle", "automotive", "tuning", "mechanic", "fuse", "manual"],
  vehicle: ["car", "automotive"],
  course: ["class", "lecture", "learning", "education", "study"],
  learn: ["course", "tutorial", "education", "study"],
  guitar: ["music", "song", "instrument"],
  piano: ["music", "song", "instrument"],
  video: ["editing", "clip", "reel", "short", "motion"],
  reel: ["video", "short", "clip", "social"],
  image: ["photo", "graphic", "visual", "picture"],
  design: ["graphic", "creative", "ui", "ux"],
  "3d": ["cad", "model", "modeling", "animation"],
  cad: ["3d", "engineering", "model"],
  terrain: ["map", "gis", "topography", "elevation", "lidar"],
  code: ["developer", "programming", "software"],
  programming: ["code", "developer", "software"],
  research: ["search", "source", "evidence", "paper"],
  free: ["no-cost"],
  calendar: ["schedule", "planning"],
  workflow: ["automation", "process", "productivity"],
  website: ["site", "web", "landing", "page"],
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function tokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]*/g) || []).filter(
    (token) => token.length > 1 && !STOPWORDS.has(token),
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function domainOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

function connectorForDomain(domain: string): string | null {
  const mapping: Record<string, string> = {
    "canva.com": "Canva",
    "figma.com": "Figma",
    "github.com": "GitHub",
    "notion.so": "Notion",
    "replit.com": "Replit",
    "wix.com": "Wix",
    "hubspot.com": "HubSpot",
    "chatgpt.com": "ChatGPT native",
  };
  if (mapping[domain]) return mapping[domain];
  if (domain.endsWith(".hubspot.com")) return "HubSpot";
  return null;
}

function normalizeAdapters(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean));
}

function intersect(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((value) => b.has(value));
}

function expand(values: Set<string>): Set<string> {
  const out = new Set(values);
  for (const value of values) {
    for (const alias of ALIASES[value] || []) out.add(alias);
  }
  return out;
}

function namedAcronyms(task: string): Set<string> {
  return new Set(
    (task.match(/\b[A-Z][A-Z0-9]{1,6}\b/g) || [])
      .map((value) => value.toLowerCase())
      .filter((value) => !NON_ENTITY_ACRONYMS.has(value)),
  );
}

function intent(task: string) {
  const lower = task.toLowerCase();
  return {
    wantsFree: /\b(free|no cost|without paying)\b/.test(lower),
    wantsNoLogin: /\b(no login|no account|without (?:an )?account|no signup|no sign-up)\b/.test(lower),
    wantsBrowser: /\b(browser|web based|web-based|online)\b/.test(lower),
    wantsApi: /\bapi\b/.test(lower),
    wantsMcp: /\bmcp\b/.test(lower),
    wantsCli: /\b(cli|command line|terminal)\b/.test(lower),
    wantsExecute: /\b(do it|execute|run|create|send|post|publish|build|edit|update|upload|book|schedule)\b/.test(lower),
  };
}

async function decodeCatalog(): Promise<CatalogTool[]> {
  const binary = atob(CATALOG_B64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const body = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(body).text();
  const compact = JSON.parse(text) as CompactRegistry;
  if (!Array.isArray(compact.tools) || compact.tools.length !== 1414) {
    throw new Error(`embedded Web Surfers catalog count mismatch: ${compact.tools?.length || 0}`);
  }

  return compact.tools.map((record, index) => {
    const [name, url, categoryIndex, subcategoryIndex, priceIndex, keywords] = record;
    const domain = domainOf(url);
    const loginCode = compact.login[String(index)];
    return {
      tool_id: `ws-${String(index + 1).padStart(4, "0")}-${slug(name)}`,
      website_name: name,
      canonical_url: url,
      domain,
      category: compact.cats[categoryIndex] || "",
      subcategory: compact.subs[subcategoryIndex] || "",
      pricing: PRICES[priceIndex] || "unknown",
      keywords: Array.isArray(keywords) ? keywords : [],
      login: loginCode === 0 ? "not_required_claimed" : loginCode === 1 ? "required_claimed" : "unknown",
      direct_connector: connectorForDomain(domain),
    };
  });
}

function loadCatalog(): Promise<CatalogTool[]> {
  if (!catalogPromise) catalogPromise = decodeCatalog();
  return catalogPromise;
}

function scoreTool(task: string, tool: CatalogTool) {
  const requestTokens = new Set(tokens(task));
  const semantic = new Set([...requestTokens].filter((value) => !CONSTRAINTS.has(value)));
  if (!semantic.size) return { score: 0, reason: [] as string[] };

  const nameTokens = new Set(tokens(tool.website_name));
  const categoryTokens = new Set(tokens(`${tool.category} ${tool.subcategory}`));
  const keywordTokens = new Set(tool.keywords.filter((value) => !CONSTRAINTS.has(value)));
  const allToolTokens = new Set([...nameTokens, ...categoryTokens, ...keywordTokens]);
  const rawOverlap = intersect(semantic, allToolTokens);
  const exactName = task.toLowerCase().includes(tool.website_name.toLowerCase().trim());
  const acronyms = namedAcronyms(task);
  const acronymOverlap = intersect(acronyms, allToolTokens);

  if (acronyms.size && !acronymOverlap.length) return { score: 0, reason: [] as string[] };
  if (semantic.size >= 3 && rawOverlap.length < 2 && !exactName) return { score: 0, reason: [] as string[] };
  if (!rawOverlap.length && !exactName) return { score: 0, reason: [] as string[] };

  let score = 0;
  const reason: string[] = [];
  if (exactName) {
    score += 12;
    reason.push("exact tool-name match");
  }
  if (acronymOverlap.length) {
    score += 6 * acronymOverlap.length;
    reason.push(`named entity match: ${acronymOverlap.slice(0, 4).join(", ")}`);
  }

  const nameOverlap = intersect(semantic, nameTokens);
  if (nameOverlap.length) {
    score += 5 * nameOverlap.length;
    reason.push(`name match: ${nameOverlap.slice(0, 5).join(", ")}`);
  }
  const categoryOverlap = intersect(semantic, categoryTokens);
  if (categoryOverlap.length) {
    score += 2.25 * categoryOverlap.length;
    reason.push(`category match: ${categoryOverlap.slice(0, 5).join(", ")}`);
  }
  const keywordOverlap = intersect(semantic, keywordTokens);
  if (keywordOverlap.length) {
    score += 2 * keywordOverlap.length;
    reason.push(`capability match: ${keywordOverlap.slice(0, 6).join(", ")}`);
  }

  const aliasOnly = new Set([...expand(semantic)].filter((value) => !semantic.has(value)));
  const aliasOverlap = intersect(aliasOnly, allToolTokens);
  if (aliasOverlap.length) {
    score += 0.35 * Math.min(5, aliasOverlap.length);
    reason.push(`related capability: ${aliasOverlap.slice(0, 4).join(", ")}`);
  }

  const flags = intent(task);
  if (flags.wantsFree) {
    if (tool.pricing === "free") {
      score += 4;
      reason.push("free");
    } else if (tool.pricing === "freemium") {
      score += 1.5;
      reason.push("freemium");
    } else if (tool.pricing === "paid") score -= 6;
  }
  if (flags.wantsNoLogin) {
    if (tool.login === "not_required_claimed") {
      score += 5;
      reason.push("directory explicitly indicates no account");
    } else if (tool.login === "required_claimed") score -= 5;
  }
  if (flags.wantsBrowser) {
    score += 2.5;
    reason.push("browser-based candidate");
  }
  if (tool.direct_connector) {
    score += 0.5;
    reason.push(`direct connector available: ${tool.direct_connector}`);
    if (flags.wantsExecute) score += 2;
  }
  if (flags.wantsApi || flags.wantsMcp || flags.wantsCli) score -= 0.5;

  return { score: Math.round(score * 1000) / 1000, reason };
}

async function embeddedCatalogRoute(body: RouteBody & { task: string; limit: number }) {
  const catalog = await loadCatalog();
  const runtime = normalizeAdapters(body.runtime_adapters);
  const flags = intent(body.task);
  const ranked = catalog
    .filter((tool) => body.include_paid !== false || tool.pricing !== "paid")
    .map((tool) => ({ tool, ...scoreTool(body.task, tool) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Boolean(b.tool.direct_connector) !== Boolean(a.tool.direct_connector)) return b.tool.direct_connector ? 1 : -1;
      if ((b.tool.pricing === "free") !== (a.tool.pricing === "free")) return b.tool.pricing === "free" ? 1 : -1;
      return a.tool.website_name.length - b.tool.website_name.length;
    });

  const seen = new Set<string>();
  const results: PublicToolResult[] = [];
  for (const row of ranked) {
    const key = row.tool.canonical_url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const connector = row.tool.direct_connector;
    const live = Boolean(connector && runtime.has(connector));
    results.push({
      score: row.score,
      mode: live ? (flags.wantsExecute ? "execute_direct" : "select_direct") : connector ? "connector_candidate" : "research_or_browser",
      can_execute_now: live,
      tool_id: row.tool.tool_id,
      website_name: row.tool.website_name,
      canonical_url: row.tool.canonical_url,
      domain: row.tool.domain,
      category: row.tool.category,
      subcategory: row.tool.subcategory,
      pricing: row.tool.pricing,
      direct_connector: connector,
      runtime_adapter_live: live,
      reason: row.reason,
    });
    if (results.length >= body.limit) break;
  }

  return {
    ok: true,
    status: results.length ? "matched" : "no_match",
    task: body.task,
    source: "embedded_private_websurfers",
    catalog_scope: "full 1414-resource private catalog; task-scoped top results only",
    primary: results[0] || null,
    fallbacks: results.slice(1),
    results,
    execution_note: "Selection uses the full private catalog. Execution remains allowed only when a direct connector is explicitly reported live in this request.",
  };
}

function sanitizeToolResult(value: unknown): PublicToolResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const allowed: PublicToolResult = {
    score: typeof row.score === "number" ? row.score : undefined,
    mode: typeof row.mode === "string" ? row.mode : undefined,
    can_execute_now: typeof row.can_execute_now === "boolean" ? row.can_execute_now : undefined,
    tool_id: typeof row.tool_id === "string" ? row.tool_id : undefined,
    website_name: typeof row.website_name === "string" ? row.website_name : undefined,
    canonical_url: typeof row.canonical_url === "string" ? row.canonical_url : undefined,
    domain: typeof row.domain === "string" ? row.domain : undefined,
    category: typeof row.category === "string" ? row.category : undefined,
    subcategory: typeof row.subcategory === "string" ? row.subcategory : undefined,
    pricing: typeof row.pricing === "string" ? row.pricing : undefined,
    direct_connector: typeof row.direct_connector === "string" || row.direct_connector === null ? row.direct_connector as string | null : undefined,
    runtime_adapter_live: typeof row.runtime_adapter_live === "boolean" ? row.runtime_adapter_live : undefined,
    reason: Array.isArray(row.reason) ? row.reason.slice(0, 8) : undefined,
    lucas_confirmed_parts: Array.isArray(row.lucas_confirmed_parts) ? row.lucas_confirmed_parts.slice(0, 10) : undefined,
    lucas_review_only_parts: Array.isArray(row.lucas_review_only_parts) ? row.lucas_review_only_parts.slice(0, 10) : undefined,
  };
  return allowed.website_name || allowed.domain ? allowed : null;
}

function sanitizeUpstream(payload: unknown, task: string, limit: number) {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const candidates = Array.isArray(raw.results)
    ? raw.results
    : [raw.primary, ...(Array.isArray(raw.fallbacks) ? raw.fallbacks : [])];
  const results = candidates.map(sanitizeToolResult).filter((row): row is PublicToolResult => row !== null).slice(0, limit);
  if (!results.length && raw.status !== "no_match") return null;
  return {
    ok: true,
    status: results.length ? "matched" : "no_match",
    task,
    source: "private_tool_router",
    catalog_scope: "task-scoped top results only",
    primary: results[0] || null,
    fallbacks: results.slice(1),
    results,
    execution_note: "The Switchboard strips upstream payloads to a small allow-listed result schema; the paid catalog itself is not returned.",
  };
}

async function upstreamRoute(body: RouteBody & { task: string; limit: number }, env: ToolRoutingEnv): Promise<Response | null> {
  if (!env.TOOL_ROUTER_URL) return null;
  let url: URL;
  try {
    url = new URL(env.TOOL_ROUTER_URL);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const base = url.toString().endsWith("/") ? url.toString() : `${url.toString()}/`;
  const endpoint = new URL("route", base);
  const headers = new Headers({ "content-type": "application/json" });
  if (env.TOOL_ROUTER_SHARED_SECRET) headers.set("authorization", `Bearer ${env.TOOL_ROUTER_SHARED_SECRET}`);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const sanitized = sanitizeUpstream(payload, body.task, body.limit);
    return sanitized ? json(sanitized) : null;
  } catch {
    return null;
  }
}

export async function routeTools(request: Request, env: ToolRoutingEnv): Promise<Response> {
  let body: RouteBody;
  try {
    body = (await request.json()) as RouteBody;
  } catch {
    return json({ ok: false, error: "Request body must be valid JSON" }, 400);
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) return json({ ok: false, error: "task is required" }, 400);
  if (task.length > 10_000) return json({ ok: false, error: "task is too large" }, 413);

  const limit = Math.min(Math.max(Number(body.limit || 3), 1), 5);
  const normalized: RouteBody & { task: string; limit: number } = {
    task,
    limit,
    runtime_adapters: Array.from(normalizeAdapters(body.runtime_adapters)).slice(0, 50),
    include_paid: body.include_paid !== false,
  };

  const upstream = await upstreamRoute(normalized, env);
  if (upstream) return upstream;
  try {
    return json(await embeddedCatalogRoute(normalized));
  } catch (error) {
    return json({
      ok: false,
      status: "router_unavailable",
      error: error instanceof Error ? error.message : String(error),
      note: "The private embedded catalog could not be loaded; no website recommendation was fabricated.",
    }, 503);
  }
}
