export interface HermesJobsEnv {
  HERMES_JOBS?: KVNamespace;
  SWITCHBOARD_API_KEY: string;
  HERMES_WORKER_KEY?: string;
}

type HermesStatus = "queued" | "running" | "completed" | "failed";

type HermesJob = {
  id: string;
  status: HermesStatus;
  task: string;
  timeout_seconds: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  result?: string;
  error?: string;
  provider?: string;
  model?: string;
  profile?: string;
};

const PREFIX = "hermes:job:";
const MAX_TASK_CHARS = 12_000;
const MAX_RESULT_CHARS = 50_000;
const RETENTION_SECONDS = 7 * 24 * 60 * 60;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function authorized(request: Request, secret?: string): boolean {
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function redact(value: string): string {
  return value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]")
    .slice(0, MAX_RESULT_CHARS);
}

function publicJob(job: HermesJob) {
  return {
    id: job.id,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at || null,
    completed_at: job.completed_at || null,
    failed_at: job.failed_at || null,
    result: job.status === "completed" ? job.result || "" : null,
    error: job.status === "failed" ? job.error || "Hermes job failed" : null,
    provider: job.provider || null,
    model: job.model || null,
    profile: job.profile || null,
  };
}

async function load(env: HermesJobsEnv, id: string): Promise<HermesJob | null> {
  if (!env.HERMES_JOBS) return null;
  return env.HERMES_JOBS.get(`${PREFIX}${id}`, "json") as Promise<HermesJob | null>;
}

async function save(env: HermesJobsEnv, job: HermesJob): Promise<void> {
  if (!env.HERMES_JOBS) throw new Error("Hermes job store is not configured");
  await env.HERMES_JOBS.put(`${PREFIX}${job.id}`, JSON.stringify(job), { expirationTtl: RETENTION_SECONDS });
}

async function createJob(request: Request, env: HermesJobsEnv): Promise<Response> {
  if (!authorized(request, env.SWITCHBOARD_API_KEY)) return json({ ok: false, error: "Unauthorized" }, 401);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Request body must be valid JSON" }, 400);
  }
  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) return json({ ok: false, error: "task is required" }, 400);
  if (task.length > MAX_TASK_CHARS) return json({ ok: false, error: `task exceeds ${MAX_TASK_CHARS} characters` }, 413);
  const requestedTimeout = Number(body.timeout_seconds || 900);
  const timeout_seconds = Math.max(60, Math.min(Number.isFinite(requestedTimeout) ? requestedTimeout : 900, 1200));
  const id = `hermes-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const job: HermesJob = {
    id,
    status: "queued",
    task,
    timeout_seconds,
    created_at: new Date().toISOString(),
  };
  await save(env, job);
  return json({ ok: true, job: publicJob(job) }, 202);
}

async function getJob(request: Request, env: HermesJobsEnv, id: string): Promise<Response> {
  if (!authorized(request, env.SWITCHBOARD_API_KEY)) return json({ ok: false, error: "Unauthorized" }, 401);
  const job = await load(env, id);
  if (!job) return json({ ok: false, error: "Hermes job not found" }, 404);
  return json({ ok: true, job: publicJob(job) });
}

async function claimJob(request: Request, env: HermesJobsEnv): Promise<Response> {
  if (!authorized(request, env.HERMES_WORKER_KEY)) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!env.HERMES_JOBS) return json({ ok: false, error: "Hermes job store is not configured" }, 503);
  const listed = await env.HERMES_JOBS.list({ prefix: PREFIX, limit: 250 });
  const candidates: HermesJob[] = [];
  for (const key of listed.keys) {
    const job = await env.HERMES_JOBS.get(key.name, "json") as HermesJob | null;
    if (job?.status === "queued") candidates.push(job);
  }
  candidates.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const job = candidates[0];
  if (!job) return json({ ok: true, job: null });
  job.status = "running";
  job.started_at = new Date().toISOString();
  await save(env, job);
  return json({ ok: true, job: { id: job.id, task: job.task, timeout_seconds: job.timeout_seconds, created_at: job.created_at, started_at: job.started_at } });
}

async function updateJob(request: Request, env: HermesJobsEnv, id: string): Promise<Response> {
  if (!authorized(request, env.HERMES_WORKER_KEY)) return json({ ok: false, error: "Unauthorized" }, 401);
  const job = await load(env, id);
  if (!job) return json({ ok: false, error: "Hermes job not found" }, 404);
  if (job.status !== "running") return json({ ok: false, error: `Cannot update job from status ${job.status}` }, 409);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Request body must be valid JSON" }, 400);
  }
  const status = body.status;
  if (status !== "completed" && status !== "failed") return json({ ok: false, error: "status must be completed or failed" }, 400);
  job.provider = typeof body.provider === "string" ? body.provider.slice(0, 80) : job.provider;
  job.model = typeof body.model === "string" ? body.model.slice(0, 120) : job.model;
  job.profile = typeof body.profile === "string" ? body.profile.slice(0, 120) : job.profile;
  if (status === "completed") {
    job.status = "completed";
    job.completed_at = new Date().toISOString();
    job.result = redact(String(body.result || ""));
    delete job.error;
  } else {
    job.status = "failed";
    job.failed_at = new Date().toISOString();
    job.error = redact(String(body.error || "Hermes job failed")).slice(0, 4000);
    delete job.result;
  }
  await save(env, job);
  return json({ ok: true, job: publicJob(job) });
}

export async function routeHermesJobs(request: Request, env: HermesJobsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/hermes/")) return null;
  if (!env.HERMES_JOBS) return json({ ok: false, error: "Hermes job store is not configured" }, 503);

  if (request.method === "POST" && url.pathname === "/hermes/jobs") return createJob(request, env);
  if (request.method === "POST" && url.pathname === "/hermes/internal/claim") return claimJob(request, env);

  const publicMatch = url.pathname.match(/^\/hermes\/jobs\/([A-Za-z0-9._-]+)$/);
  if (request.method === "GET" && publicMatch) return getJob(request, env, publicMatch[1]);

  const internalMatch = url.pathname.match(/^\/hermes\/internal\/jobs\/([A-Za-z0-9._-]+)$/);
  if (request.method === "POST" && internalMatch) return updateJob(request, env, internalMatch[1]);

  return json({ ok: false, error: "Hermes endpoint not found" }, 404);
}
