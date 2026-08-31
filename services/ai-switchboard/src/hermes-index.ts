import base from "./index";
import { routeHermesJobs, type HermesJobsEnv } from "./hermes-jobs";
import type { ToolRoutingEnv } from "./tool-routing";

interface Env extends ToolRoutingEnv, HermesJobsEnv {
  OPENROUTER_API_KEY: string;
  SWITCHBOARD_API_KEY: string;
  HERMES_WORKER_KEY?: string;
  OX_MODEL?: string;
  QWEN_MODEL?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function hermesPaths() {
  return {
    "/hermes/jobs": {
      post: {
        operationId: "createHermesJob",
        summary: "Queue a read-only Hermes research/reasoning job on Nicholas's Mac worker.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["task"],
                properties: {
                  task: { type: "string", maxLength: 12000 },
                  timeout_seconds: { type: "integer", minimum: 60, maximum: 1200, default: 900 },
                },
              },
            },
          },
        },
        responses: {
          "202": { description: "Hermes job accepted and queued" },
          "400": { description: "Invalid request" },
          "401": { description: "Unauthorized" },
          "503": { description: "Hermes job store unavailable" },
        },
      },
    },
    "/hermes/jobs/{job_id}": {
      get: {
        operationId: "getHermesJob",
        summary: "Read the status and final result of a Hermes job.",
        parameters: [
          {
            name: "job_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Hermes job status/result" },
          "401": { description: "Unauthorized" },
          "404": { description: "Hermes job not found" },
        },
      },
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      const response = await base.fetch(request, env);
      const body = await response.json() as Record<string, any>;
      body.info = body.info || {};
      body.info.version = "1.2.0";
      body.info.description = `${body.info.description || "Nicholas AI Switchboard"} Hermes jobs use a persistent authenticated queue and a read-only Mac execution profile.`;
      body.paths = { ...(body.paths || {}), ...hermesPaths() };
      return json(body);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const response = await base.fetch(request, env);
      const body = await response.json() as Record<string, unknown>;
      return json({ ...body, version: "1.2.0", hermes_jobs: Boolean(env.HERMES_JOBS) });
    }

    const hermes = await routeHermesJobs(request, env);
    if (hermes) return hermes;
    return base.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;
