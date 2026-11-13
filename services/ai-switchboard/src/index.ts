import { routeTools, type ToolRoutingEnv } from "./tool-routing";
import { handleAtlas } from "./atlas";

export interface SwitchboardEnv extends ToolRoutingEnv {
  OPENROUTER_API_KEY: string;
  SWITCHBOARD_API_KEY: string;
  OX_MODEL?: string;
  QWEN_MODEL?: string;
  ALLOW_PAID_AI?: string | boolean;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
}

const MODEL_ALIASES = ["ox", "qwen", "auto", "free", "qwen-flash"] as const;
type ModelAlias = typeof MODEL_ALIASES[number];

type Completion = {
  model?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { cost?: number };
  error?: { code?: number; message?: string; metadata?: { limit_source?: string; reason?: string } };
};

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
const FREE_MODEL = "openrouter/free";
const QWEN_FLASH_MODEL = "qwen/qwen3.7-flash";
const DEFAULT_MAX_TOKENS = 1500;
const MIN_MAX_TOKENS = 256;
const MAX_MAX_TOKENS = 16000;
const CREDIT_RETRY_TOKENS = 750;
const MODEL_CACHE_MS = 5 * 60 * 1000;

const LIMIT_ERRORS: Record<string, string> = {
  openrouter_credits: "The request exceeds your available OpenRouter credits. Check the balance or use native ChatGPT.",
  openrouter_key_limit: "The Switchboard key reached its spending limit. Check the key allowance and reset time.",
  openrouter_in_flight_budget: "Other OpenRouter requests are using the available budget. Wait for them to settle.",
  openrouter_guardrail_budget: "An OpenRouter guardrail reached its spending limit. Check its reset time.",
  openrouter_workspace_budget: "The OpenRouter workspace reached its spending limit. Check its reset time.",
  openrouter_free_tier_per_minute: "OpenRouter's free request rate was reached. Wait for the reset or use native ChatGPT.",
  openrouter_free_tier_per_day: "OpenRouter's free daily allowance was reached. Wait for the reset or use native ChatGPT.",
  upstream_provider_shared_pool: "The selected model is at capacity. Wait or choose another reviewer.",
};

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

function isAuthorized(request: Request, env: SwitchboardEnv): boolean {
  if (!env.SWITCHBOARD_API_KEY) return false;
  return request.headers.get("authorization") === `Bearer ${env.SWITCHBOARD_API_KEY}`;
}

function openRouterHeaders(env: SwitchboardEnv): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  });
  if (env.OPENROUTER_SITE_URL) headers.set("HTTP-Referer", env.OPENROUTER_SITE_URL);
  headers.set("X-Title", env.OPENROUTER_APP_NAME || "Nicholas AI Switchboard");
  return headers;
}

async function getModels(env: SwitchboardEnv, force = false): Promise<OpenRouterModel[]> {
  const now = Date.now();
  if (!force && modelCache && now - modelCache.at < MODEL_CACHE_MS) return modelCache.models;

  const response = await fetch(`${OPENROUTER_API}/models`, {
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
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

function newestOx(models: OpenRouterModel[]): string {
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

  return candidates[0]?.id || DEFAULT_OX_MODEL;
}

function newestQwen(models: OpenRouterModel[]): string {
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

  return candidates[0]?.id || DEFAULT_QWEN_MODEL;
}

async function resolveModel(alias: ModelAlias, env: SwitchboardEnv): Promise<string> {
  if (alias === "auto") return DEFAULT_AUTO_MODEL;
  if (alias === "free") return FREE_MODEL;
  if (alias === "qwen-flash") return QWEN_FLASH_MODEL;
  if (alias === "ox") return env.OX_MODEL || newestOx(await getModels(env));
  return env.QWEN_MODEL || newestQwen(await getModels(env));
}

async function resolvedAliases(env: SwitchboardEnv, force = false) {
  const models = await getModels(env, force);
  return {
    ox: env.OX_MODEL || newestOx(models),
    qwen: env.QWEN_MODEL || newestQwen(models),
    auto: DEFAULT_AUTO_MODEL,
    free: FREE_MODEL,
    "qwen-flash": QWEN_FLASH_MODEL,
    catalog_count: models.length,
    catalog_checked_at: new Date().toISOString(),
  };
}

function affordableRetry(payload: Completion | null, maxTokens: number): number {
  const error = payload?.error;
  const source = error?.metadata?.limit_source;
  // Older 402 responses can give an affordable token count without limit metadata.
  if (!source || source === "openrouter_credits" || source === "openrouter_key_limit") {
    const match = typeof error?.message === "string" && error.message.match(/but can only afford (\d+)\b/i);
    if (match) return Math.min(maxTokens, Number(match[1]));
  }
  if (source === "openrouter_credits" && error?.metadata?.reason === "weight_exceeds_budget") {
    return Math.min(maxTokens, CREDIT_RETRY_TOKENS);
  }
  return maxTokens;
}

async function ask(request: Request, env: SwitchboardEnv): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json({ ok: false, error: "OPENROUTER_API_KEY is not configured" }, 503);
  }

  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return json({ ok: false, error: "Request body must be valid JSON" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Request body must be a JSON object" }, 400);
  }

  const alias = body.model === undefined ? "ox" : body.model;
  if (!MODEL_ALIASES.includes(alias)) {
    return json({ ok: false, error: "Unknown model alias" }, 400);
  }
  if (alias !== "free" && String(env.ALLOW_PAID_AI).trim().toLowerCase() === "false") {
    return json({ ok: false, error_code: "paid_ai_disabled", error: "Paid models are disabled. Use free or native ChatGPT." }, 403);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const system = typeof body.system === "string" ? body.system.trim() : "";
  const requestedTokens = body.max_tokens === undefined ? DEFAULT_MAX_TOKENS : body.max_tokens;

  if (!prompt) return json({ ok: false, error: "prompt is required" }, 400);
  if (prompt.length + system.length > 200_000) return json({ ok: false, error: "Model input is too large" }, 413);
  if (!Number.isSafeInteger(requestedTokens) || requestedTokens < 1) {
    return json({ ok: false, error: "max_tokens must be a positive integer" }, 400);
  }
  let maxTokens = Math.min(Math.max(requestedTokens, MIN_MAX_TOKENS), MAX_MAX_TOKENS);

  let resolvedModel: string;
  try {
    resolvedModel = await resolveModel(alias, env);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 502);
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]);
  const complete = async (max_tokens: number) => {
    const response = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: "POST",
      headers: openRouterHeaders(env),
      redirect: "manual",
      signal,
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        max_tokens,
        stream: false,
        ...(alias === "qwen-flash" && {
          provider: { max_price: { prompt: 0.1, completion: 0.3, request: 0 } },
        }),
      }),
    });
    const payload = (await response.json().catch(() => {
      signal.throwIfAborted();
      return null;
    })) as Completion | null;
    return { response, payload };
  };

  let attempts = 1;
  let result: Awaited<ReturnType<typeof complete>>;
  try {
    result = await complete(maxTokens);
    if (result.response.status === 402 && alias !== "free") {
      const reducedTokens = affordableRetry(result.payload, maxTokens);
      if (reducedTokens >= MIN_MAX_TOKENS && reducedTokens < maxTokens) {
        maxTokens = reducedTokens;
        attempts += 1;
        result = await complete(maxTokens);
      }
    }
  } catch {
    return json({
      ok: false,
      requested_model: alias,
      resolved_model: resolvedModel,
      attempts,
      error: "OpenRouter did not return a response. Check Activity before retrying.",
    }, signal.aborted ? 504 : 502);
  }

  const { response, payload } = result;
  const details = { requested_model: alias, resolved_model: resolvedModel, attempts, max_tokens: maxTokens };
  if (!response.ok || payload?.error) {
    const status = response.ok ? payload?.error?.code || 502 : response.status;
    const source = payload?.error?.metadata?.limit_source;
    const limitSource = typeof source === "string" && Object.hasOwn(LIMIT_ERRORS, source) ? source : null;
    const retryAfter = response.headers.get("retry-after");
    const error = limitSource ? LIMIT_ERRORS[limitSource] : {
      402: "OpenRouter declined the request for credit reasons. Check Credits and API Keys.",
      429: "OpenRouter rate limit reached. Check the retry interval or use native ChatGPT.",
    }[status] ?? `OpenRouter request failed (${status})`;
    return json({
      ok: false,
      ...details,
      upstream_status: status,
      limit_source: limitSource,
      retry_after: retryAfter,
      rate_limit_reset_ms: Number(response.headers.get("x-ratelimit-reset")) || null,
      error,
    }, [402, 403, 429].includes(status) ? status : 502, retryAfter ? { "retry-after": retryAfter } : {});
  }

  const choice = payload?.choices?.[0];
  const text = choice?.message?.content;
  const cost = payload?.usage?.cost;
  const outcome = {
    ...details,
    response_model: typeof payload?.model === "string" ? payload.model : null,
    finish_reason: choice?.finish_reason ?? null,
    truncated: choice?.finish_reason === "length",
    cost_usd: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null,
    usage: payload?.usage ?? null,
  };
  if (typeof text !== "string" || !text.trim() || choice?.finish_reason === "error") {
    return json({ ok: false, ...outcome, error: "OpenRouter returned no usable text. Check the finish reason and usage." }, 502);
  }
  return json({ ok: true, ...outcome, text });
}

function openApi(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Nicholas AI Switchboard",
      version: "1.1.0",
      description: "Route explicit requests to external models and return private, task-scoped tool-routing recommendations.",
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
          summary: "Resolve the live model IDs for Switchboard aliases.",
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
                    model: { type: "string", enum: MODEL_ALIASES },
                    prompt: { type: "string", description: "The user request to send to the selected external model." },
                    system: { type: "string", description: "Optional short system instruction for the external model." },
                    max_tokens: {
                      type: "integer", minimum: MIN_MAX_TOKENS, maximum: MAX_MAX_TOKENS, default: DEFAULT_MAX_TOKENS,
                      description: "Output allowance. Start at 1500 for a short evidence review. OpenRouter checks the allowance against available credits.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "External model response" },
            "400": { description: "Invalid model, prompt, or output allowance" },
            "401": { description: "Unauthorized" },
            "402": { description: "Credit, key, or in-flight budget limit" },
            "403": { description: "Paid routing disabled or provider budget blocked" },
            "429": { description: "Rate limited" },
            "502": { description: "Upstream provider error" },
            "504": { description: "Provider response timed out" },
          },
        },
      },
      "/tools/route": {
        post: {
          operationId: "routeNicholasTool",
          summary: "Choose a small task-scoped set of tools without exposing the private paid catalog.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["task"],
                  properties: {
                    task: { type: "string", maxLength: 10000 },
                    runtime_adapters: {
                      type: "array",
                      maxItems: 50,
                      items: { type: "string" },
                      description: "Adapters the caller has verified are live in the current runtime.",
                    },
                    limit: { type: "integer", minimum: 1, maximum: 5, default: 3 },
                    include_paid: { type: "boolean", default: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Primary tool plus limited fallbacks" },
            "400": { description: "Invalid task" },
            "401": { description: "Unauthorized" },
          },
        },
      },
    },
  };
}

export default {
  async fetch(request: Request, env: SwitchboardEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "nicholas-ai-switchboard", version: "1.1.0", tool_routing: true, atlas: true });
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return json(openApi(url.origin));
    }

    if (request.method === "GET" && url.pathname === "/privacy") {
      return new Response(
        "Nicholas AI Switchboard is a private routing service. Prompts explicitly routed to external models are sent to OpenRouter and the selected third-party model provider. Tool routing is task-scoped: the service returns only a small ranked set and does not expose the underlying paid membership catalog through the authenticated routing API. The separately published Digital Atlas contains only the website-directory fields intentionally made public by the site owner. Do not send secrets, credentials, private client records, financial records, or other sensitive data unless you have intentionally approved that disclosure. The switchboard itself does not intentionally persist prompts, routing tasks, or model responses.",
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    const atlas = await handleAtlas(request);
    if (atlas) return atlas;

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
    if (request.method === "POST" && url.pathname === "/tools/route") return routeTools(request, env);

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<SwitchboardEnv>;
