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

type ConnectorTool = {
  website_name: string;
  canonical_url: string;
  domain: string;
  direct_connector: string;
  pricing: "free" | "freemium" | "paid" | "unknown";
  keywords: string[];
};

const CONNECTOR_TOOLS: ConnectorTool[] = [
  {
    website_name: "Canva",
    canonical_url: "https://www.canva.com/",
    domain: "canva.com",
    direct_connector: "Canva",
    pricing: "freemium",
    keywords: ["design", "graphic", "social", "post", "presentation", "image", "creative", "flyer"],
  },
  {
    website_name: "Figma",
    canonical_url: "https://www.figma.com/",
    domain: "figma.com",
    direct_connector: "Figma",
    pricing: "freemium",
    keywords: ["figma", "design", "ui", "ux", "prototype", "wireframe", "interface", "mockup"],
  },
  {
    website_name: "GitHub",
    canonical_url: "https://github.com/",
    domain: "github.com",
    direct_connector: "GitHub",
    pricing: "freemium",
    keywords: ["github", "repo", "repository", "code", "issue", "pull", "request", "commit", "branch"],
  },
  {
    website_name: "Notion",
    canonical_url: "https://www.notion.so/",
    domain: "notion.so",
    direct_connector: "Notion",
    pricing: "freemium",
    keywords: ["notion", "database", "page", "wiki", "notes", "workspace", "document", "knowledge"],
  },
  {
    website_name: "Replit",
    canonical_url: "https://replit.com/",
    domain: "replit.com",
    direct_connector: "Replit",
    pricing: "freemium",
    keywords: ["replit", "app", "website", "code", "prototype", "developer", "build", "deploy"],
  },
  {
    website_name: "Wix",
    canonical_url: "https://www.wix.com/",
    domain: "wix.com",
    direct_connector: "Wix",
    pricing: "freemium",
    keywords: ["wix", "website", "site", "landing", "page", "business", "web", "store"],
  },
  {
    website_name: "HubSpot",
    canonical_url: "https://www.hubspot.com/",
    domain: "hubspot.com",
    direct_connector: "HubSpot",
    pricing: "freemium",
    keywords: ["hubspot", "crm", "lead", "contact", "sales", "deal", "marketing", "customer"],
  },
  {
    website_name: "ChatGPT",
    canonical_url: "https://chatgpt.com/",
    domain: "chatgpt.com",
    direct_connector: "ChatGPT native",
    pricing: "freemium",
    keywords: ["chatgpt", "write", "reason", "summarize", "brainstorm", "analyze", "research", "draft"],
  },
];

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "get",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "show", "that", "the",
  "this", "to", "tool", "tools", "use", "using", "want", "with", "you", "your", "find", "need",
]);

function tokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]*/g) || []).filter(
    (token) => token.length > 1 && !STOPWORDS.has(token),
  );
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function normalizeAdapters(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean));
}

function localConnectorRoute(body: Required<Pick<RouteBody, "task" | "limit">> & RouteBody) {
  const taskTokens = new Set(tokens(body.task));
  const runtime = normalizeAdapters(body.runtime_adapters);
  const wantsExecute = /\b(create|build|edit|update|send|post|publish|upload|run|execute|schedule)\b/i.test(body.task);

  const ranked = CONNECTOR_TOOLS.map((tool) => {
    const name = tool.website_name.toLowerCase();
    const exactName = body.task.toLowerCase().includes(name);
    const overlap = tool.keywords.filter((keyword) => taskTokens.has(keyword));
    let score = overlap.length * 2 + (exactName ? 12 : 0);
    if (runtime.has(tool.direct_connector)) score += wantsExecute ? 3 : 1;
    return { tool, score, overlap };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.website_name.localeCompare(b.tool.website_name))
    .slice(0, body.limit)
    .map(({ tool, score, overlap }) => {
      const live = runtime.has(tool.direct_connector);
      return {
        score,
        mode: live ? (wantsExecute ? "execute_direct" : "select_direct") : "connector_candidate",
        can_execute_now: live,
        website_name: tool.website_name,
        canonical_url: tool.canonical_url,
        domain: tool.domain,
        pricing: tool.pricing,
        direct_connector: tool.direct_connector,
        runtime_adapter_live: live,
        reason: exactOrOverlap(body.task, tool.website_name, overlap, live),
      };
    });

  return {
    ok: true,
    status: ranked.length ? "matched" : "no_match",
    task: body.task,
    source: "switchboard_connector_fallback",
    catalog_scope: "connector-capable subset only",
    primary: ranked[0] || null,
    fallbacks: ranked.slice(1),
    results: ranked,
    execution_note: "A connector candidate is executable only when its adapter is explicitly reported live in this request.",
  };
}

function exactOrOverlap(task: string, name: string, overlap: string[], live: boolean): string[] {
  const reason: string[] = [];
  if (task.toLowerCase().includes(name.toLowerCase())) reason.push("exact tool-name match");
  if (overlap.length) reason.push(`capability match: ${overlap.slice(0, 6).join(", ")}`);
  reason.push(live ? "runtime adapter reported live" : "runtime adapter not reported live");
  return reason;
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

  const endpoint = new URL("route", url.toString().endsWith("/") ? url : new URL(`${url.toString()}/`));
  const headers = new Headers({ "content-type": "application/json" });
  if (env.TOOL_ROUTER_SHARED_SECRET) {
    headers.set("authorization", `Bearer ${env.TOOL_ROUTER_SHARED_SECRET}`);
  }

  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return json({
      ok: true,
      source: "private_tool_router",
      ...((payload && typeof payload === "object") ? payload : { result: payload }),
    });
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
  return json(localConnectorRoute(normalized));
}
