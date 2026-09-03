import { ATLAS_HTML } from "./atlas-ui";
import { withAtlasDiscovery } from "./atlas-discovery";
import shard01 from "./catalog/websurfers-01.txt";
import shard02 from "./catalog/websurfers-02.txt";
import shard03 from "./catalog/websurfers-03.txt";
import shard04 from "./catalog/websurfers-04.txt";
import shard05 from "./catalog/websurfers-05.txt";
import shard06 from "./catalog/websurfers-06.txt";
import shard07 from "./catalog/websurfers-07.txt";
import shard08 from "./catalog/websurfers-08.txt";
import gaming01 from "../../../hermes/tool_registry/websurfers/gaming-tools-01.json";
import gaming02 from "../../../hermes/tool_registry/websurfers/gaming-tools-02.json";
import gaming03 from "../../../hermes/tool_registry/websurfers/gaming-tools-03.json";
import gaming04 from "../../../hermes/tool_registry/websurfers/gaming-tools-04.json";
import gaming05 from "../../../hermes/tool_registry/websurfers/gaming-tools-05.json";
import gaming06 from "../../../hermes/tool_registry/websurfers/gaming-tools-06.json";
import gaming07 from "../../../hermes/tool_registry/websurfers/gaming-tools-07.json";
import gaming08 from "../../../hermes/tool_registry/websurfers/gaming-tools-08.json";

type CompactRegistry = {
  v: number;
  cats: string[];
  subs: Array<string | null>;
  login: Record<string, number>;
  tools: Array<[string, string, number, number, number, string[], number]>;
};

type SupplementRecord = {
  n: string;
  u: string;
  c: string;
  s: string;
  p: string;
  k: string[];
  row: number;
  l?: string;
};

type Supplement = { source: string; records: SupplementRecord[] };

type AtlasTool = {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  subcategory: string;
  pricing: "free" | "freemium" | "paid" | "unknown";
  keywords: string[];
  login: "not_required_claimed" | "required_claimed" | "unknown";
  source: string;
};

const CATALOG_B64 = [shard01, shard02, shard03, shard04, shard05, shard06, shard07, shard08]
  .join("")
  .replace(/\s+/g, "");
const GAMING: Supplement[] = [gaming01, gaming02, gaming03, gaming04, gaming05, gaming06, gaming07, gaming08] as Supplement[];
const PRICES: AtlasTool["pricing"][] = ["free", "freemium", "paid", "unknown"];
const DESIGN_START_INDEX = 270;
const DESIGN_END_INDEX_EXCLUSIVE = 270 + 366;
const INVALID_DESIGN_ROWS = new Set([40, 171]);
let atlasPromise: Promise<AtlasTool[]> | undefined;

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

function validHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function sourceForBaseIndex(index: number): string {
  if (index < 270) return "AI Tools";
  if (index < 636) return "Design & Creative";
  return "Education & Learning";
}

function assertCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label} count mismatch: expected ${expected}, got ${actual}`);
}

function makeTool(
  id: string,
  name: string,
  url: string,
  category: string,
  subcategory: string,
  pricing: string,
  keywords: string[],
  login: string,
  source: string,
): AtlasTool | null {
  const domain = domainOf(url);
  if (!name.trim() || !domain || !validHttpUrl(url)) return null;
  const normalizedPrice: AtlasTool["pricing"] = PRICES.includes(pricing as AtlasTool["pricing"])
    ? pricing as AtlasTool["pricing"]
    : "unknown";
  const normalizedLogin: AtlasTool["login"] = login === "not_required_claimed" || login === "required_claimed"
    ? login
    : "unknown";
  return {
    id,
    name: name.trim(),
    url: url.trim(),
    domain,
    category: category || "Other",
    subcategory: subcategory || "General",
    pricing: normalizedPrice,
    keywords: Array.isArray(keywords) ? keywords : [],
    login: normalizedLogin,
    source,
  };
}

async function loadAtlas(): Promise<AtlasTool[]> {
  if (atlasPromise) return atlasPromise;
  atlasPromise = (async () => {
    const binary = atob(CATALOG_B64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const body = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    const compact = JSON.parse(await new Response(body).text()) as CompactRegistry;
    if (!Array.isArray(compact.tools)) throw new Error("Atlas base catalog is invalid");
    assertCount(compact.tools.length, 1414, "Atlas base");

    const tools: AtlasTool[] = [];
    compact.tools.forEach((record, index) => {
      const [name, url, categoryIndex, subcategoryIndex, priceIndex, keywords, sourceRow] = record;
      const isDesignRecord = index >= DESIGN_START_INDEX && index < DESIGN_END_INDEX_EXCLUSIVE;
      if (isDesignRecord && INVALID_DESIGN_ROWS.has(sourceRow)) return;
      const loginCode = compact.login[String(index)];
      const tool = makeTool(
        `ws-base-${String(index + 1).padStart(4, "0")}-${slug(name || "")}`,
        name || "",
        url || "",
        compact.cats[categoryIndex] || "",
        compact.subs[subcategoryIndex] || "",
        PRICES[priceIndex] || "unknown",
        keywords || [],
        loginCode === 0 ? "not_required_claimed" : loginCode === 1 ? "required_claimed" : "unknown",
        sourceForBaseIndex(index),
      );
      if (tool) tools.push(tool);
    });
    assertCount(tools.length, 1412, "Atlas filtered base");

    for (const supplement of GAMING) {
      for (const record of supplement.records || []) {
        const tool = makeTool(
          `ws-${String(tools.length + 1).padStart(4, "0")}-${slug(record.n || "")}`,
          record.n || "",
          record.u || "",
          record.c || "",
          record.s || "",
          record.p || "unknown",
          record.k || [],
          record.l || "unknown",
          "Gaming",
        );
        if (tool) tools.push(tool);
      }
    }
    assertCount(tools.length, 1800, "Atlas total");
    return tools;
  })();
  return atlasPromise;
}

function catalogResponse(tools: AtlasTool[]): Response {
  const categories = [...new Set(tools.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sources = [...new Set(tools.map((t) => t.source))];
  return new Response(JSON.stringify({
    ok: true,
    title: "Nick’s Digital Atlas",
    count: tools.length,
    domains: new Set(tools.map((t) => t.domain)).size,
    sources,
    categories,
    tools,
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}

export async function handleAtlas(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/atlas" || url.pathname === "/atlas/") {
    return new Response(withAtlasDiscovery(ATLAS_HTML), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
      },
    });
  }
  if (url.pathname === "/atlas/catalog") {
    try {
      return catalogResponse(await loadAtlas());
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
        status: 503,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  }
  return null;
}
