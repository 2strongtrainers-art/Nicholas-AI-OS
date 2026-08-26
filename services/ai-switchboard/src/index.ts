interface Env {
  OPENROUTER_API_KEY: string;
  SWITCHBOARD_API_KEY: string;
  OX_MODEL?: string;
  QWEN_MODEL?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
}

type ModelAlias = "ox" | "qwen" | "auto";

type OpenRouterModel = {
  id: string;
  name?: string;
  created?: number;
  context_length?: number;
};

type ModelCatalog = {
  data?: OpenRouterModel[];
};

type AskBody = {
  model?: ModelAlias;
  prompt?: string;
  system?: string;
  max_tokens?: number;
};

const OPENROUTER_API = "https://openrouter.ai/api/v1";
const DEFAULT_OX_MODEL = "z-ai/glm-5.3";
const DEFAULT_QWEN_MODEL = "qwen/qwen3.8-2.4t-a95b";
const DEFAULT_AUTO_MODEL = "openrouter/auto";
const MODEL_CACHE_MS = 5 * 60 * 1000;

let modelCache: { at: number; models: OpenRouterModel[] } | undefined;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.SWITCHBOARD_API_KEY) return false;
  return request.headers.get("authorization") === `Bearer ${env.SWITCHBOARD_API_KEY}`;
}

function openRouterHeaders(env: Env): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  });
  if (env.OPENROUTER_SITE_URL) headers.set("HTTP-Referer", env.OPENROUTER_SITE_URL);
  headers.set("X-Title", env.OPENROUTER_APP_NAME || "Nicholas AI Switchboard");
  return headers;
}

async function getModels(env: Env, force = false): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (!force && modelCache && now - modelCache.at < MODEL_CACHE_MS) return modelCache.models;

  const response = await fetch(`${OPENROUTER_API}/models`, {
    headers: env.OPENROUTER_API_KEY
      ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }
      : undefined,
  });
  if (!response.ok) {
    throw new Error(`OpenRouter model catalog failed (${response.status})`);
  }

  const payload = (await response.json()) as ModelCatalog;
  const models = Array.isArray(payload.data) ? payload.data : [];
  modelCache = { at: now, models };
  return models;
}

function parseQwenVersion(value: string): [number, number] {
  const match = value.toLowerCase().match(/qwen\s*([0-9]+)(?:[.\-_ ]?([0-9]+))?/);
  if (!match) return [0, 0];
  return [Number(match[1] || 0), Number(match[2] || 0)];
}

function parseScale(value: string): number {
  const lower = value.toLowerCase();
  const trillion = lower.match(/(?:^|[-_ ])(\d+(?:\.\d+)?)t(?:[-_ ]|$)/);
  if (trillion) return Number(trillion[1]) * 1000;
  const billion = lower.match(/(?:^|[-_ ])(\d+(?:\.\d+)?)b(?:[-_ ]|$)/);
  return billion ? Number(billion[1]) : 0;
}

function parseGlmVersion(value: string): [number, number] {
  const match = value.toLowerCase().match(/glm[-_. ]?([0-9]+)(?:[.-]([0-9]+))?/);
  if (!match) return [0, 0];
  return [Number(match[1] || 0), Number(match[2] || 0)];
}

function newestOx(models: OpenRouterModel[], configured?: string): string {
  if (configured && models.some((m) => m.id === configured)) return configured;

  for (const preferred of ["z-ai/glm-5.3", "z-ai/glm-latest"]) {
    if (models.some((m) => m.id === preferred)) return preferred;
  }

  const candidates = models.filter((m) => m.id.toLowerCase().startsWith("z-ai/glm-"));
  candidates.sort((a, b) => {
    const [aMajor, aMinor] = parseGlmVersion(a.id);
    const [bMajor, bMinor] = parseGlmVersion(b.id);
    if (bMajor !== aMajor) return bMajor - aMajor;
    if (bMinor !== aMinor) return bMinor - aMinor;
    return (b.created || 0) - (a.created || 0) || b.id.localeCompare(a.id);
  });

  return candidates[0]?.id || configured || DEFAULT_OX_MODEL;
}

function newestQwen(models: OpenRouterModel[], configured?: string): string {
  if (configured && models.some((m) => m.id === configured)) return configured;

  const candidates = models.filter((m) => m.id.toLowerCase().startsWith("qwen/"));
  candidates.sort((a, b) => {
    const aText = `${a.id} ${a.name || ""}`;
    const bText = `${b.id} ${b.name || ""}`;
    const [aMajor, aMinor] = parseQwenVersion(aText);
    const [bMajor, bMinor] = parseQwenVersion(bText);
    if (bMajor !== aMajor) return bMajor - aMajor;
    if (bMinor !== aMinor) return bMinor - aMinor;
    const scaleDiff = parseScale(bText) - parseScale(aText);
    if (scaleDiff !== 0) return scaleDiff;
    return (b.created || 0) - (a.created || 0) || b.id.localeCompare(a.id);
  });

  return candidates[0]?.id || configured || DEFAULT_QWEN_MODEL;
}

async function resolveModel(alias: ModelAlias, env: Env): Promise<string> {
  if (alias === "auto") return DEFAULT_AUTO_MODEL;
  const models = await getModels(env);
  if (alias === "ox") return newestOx(models, env.OX_MODEL);
  return newestQwen(models, env.QWEN_MODEL);
}

async function resolvedAliases(env: Env, force = false) {
  const models = await getModels(env, force);
  return {
    ox: newestOx(models, env.OX_MODEL),
    qwen: newestQwen(models, env.QWEN_MODEL),
    auto: DEFAULT_AUTO_MODEL,
    catalog_count: models.length,
    catalog_checked_at: new Date().toISOString(),
  };
}

async function ask(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json({ ok: false, error: "OPENROUTER_API_KEY is not configured" }, 503);
  }

  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return json({ ok: false, error: "Request body must be valid JSON" }, 400);
  }

  const alias: ModelAlias = body.model === "qwen" || body.model === "auto" ? body.model : "ox";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const system = typeof body.system === "string" ? body.system.trim() : "";
  const maxTokens = Math.min(Math.max(Number(body.max_tokens || 6000), 256), 16000);

  if (!prompt) return json({ ok: false, error: "prompt is required" }, 400);
  if (prompt.length > 200_000) return json({ ok: false, error: "prompt is too large" }, 413);

  let resolvedModel: string;
  try {
    resolvedModel = await resolveModel(alias, env);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 502);
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: openRouterHeaders(env),
    body: JSON.stringify({
      model: resolvedModel,
      messages,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  const raw = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok) {
    return json(
      {
        ok: false,
        requested_model: alias,
        resolved_model: resolvedModel,
        error: raw?.error?.message || raw?.message || `OpenRouter request failed (${response.status})`,
      },
      502,
    );
  }

  const text = raw?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    return json({ ok: false, requested_model: alias, resolved_model: resolvedModel, error: "No text response returned" }, 502);
  }

  return json({
    ok: true,
    requested_model: alias,
    resolved_model: resolvedModel,
    response_model: raw.model || resolvedModel,
    text,
    usage: raw.usage || null,
  });
}

function openApi(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Nicholas AI Switchboard",
      version: "1.0.0",
      description: "Route explicit ChatGPT requests to the current Z.AI GLM route, Qwen3.8, or OpenRouter Auto.",
    },
    servers: [{ url: origin }],
    paths: {
      "/health": {
        get: {
          operationId: "switchboardHealth",
          summary: "Check whether the AI switchboard is online.",
          responses: { "200": { description: "Health status" } },
        },
      },
      "/models": {
        get: {
          operationId: "switchboardModels",
          summary: "Resolve the live model IDs currently used for Ox, Qwen, and Auto.",
          responses: { "200": { description: "Resolved aliases" } },
        },
      },
      "/ask": {
        post: {
          operationId: "switchboardAsk",
          summary: "Send a prompt to an explicitly selected external AI model.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["model", "prompt"],
                  properties: {
                    model: { type: "string", enum: ["ox", "qwen", "auto"] },
                    prompt: { type: "string", description: "The user request to send to the selected external model." },
                    system: { type: "string", description: "Optional short system instruction for the external model." },
                    max_tokens: { type: "integer", minimum: 256, maximum: 16000, default: 6000 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "External model response" },
            "401": { description: "Unauthorized" },
            "502": { description: "Upstream provider error" },
          },
        },
      },
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "nicholas-ai-switchboard", version: "1.0.0" });
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return json(openApi(url.origin));
    }

    if (request.method === "GET" && url.pathname === "/privacy") {
      return new Response(
        "Nicholas AI Switchboard is a private routing service. Prompts explicitly routed to Ox, Qwen, or Auto are sent to OpenRouter and the selected third-party model provider. Do not send secrets, credentials, private client records, financial records, or other sensitive data unless you have intentionally approved that disclosure. The switchboard itself does not intentionally persist prompts or model responses.",
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    if (!isAuthorized(request, env)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      });
    }

    if (request.method === "GET" && url.pathname === "/models") {
      try {
        return json({ ok: true, ...(await resolvedAliases(env, url.searchParams.get("refresh") === "1")) });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 502);
      }
    }

    if (request.method === "POST" && url.pathname === "/ask") return ask(request, env);

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
