import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

interface Env {
  ELEVENLABS_API_KEY: string;
  BRIDGE_TOKEN: string;
}

const ELEVEN_API = "https://api.elevenlabs.io";

type JsonObject = Record<string, unknown>;

type MediaReference =
  | { type: "generation"; generation_id: string }
  | { type: "asset"; asset_id: string }
  | { type: "inline_base64"; content_base64: string; mime_type: string };

function asText(value: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

function parseExtra(extraJson?: string): JsonObject {
  if (!extraJson) return {};
  const parsed = JSON.parse(extraJson);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("extra_json must decode to a JSON object");
  }
  return parsed as JsonObject;
}

function makeReference(args: {
  generationId?: string;
  assetId?: string;
  base64?: string;
  mimeType?: string;
}): MediaReference | undefined {
  const selected = [args.generationId, args.assetId, args.base64].filter(Boolean).length;
  if (selected > 1) {
    throw new Error("Provide only one media source: generation ID, asset ID, or base64 data");
  }
  if (args.generationId) return { type: "generation", generation_id: args.generationId };
  if (args.assetId) return { type: "asset", asset_id: args.assetId };
  if (args.base64) {
    if (!args.mimeType) throw new Error("mime type is required when using base64 media");
    return { type: "inline_base64", content_base64: args.base64, mime_type: args.mimeType };
  }
  return undefined;
}

async function elevenFetch(env: Env, path: string, init: RequestInit = {}) {
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
  const headers = new Headers(init.headers);
  headers.set("xi-api-key", env.ELEVENLABS_API_KEY);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${ELEVEN_API}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function safe<T>(fn: () => Promise<T>) {
  try {
    return asText(await fn());
  } catch (error) {
    return asText(error instanceof Error ? error.message : String(error), true);
  }
}

async function resolveVoiceId(env: Env, voiceId?: string, voiceName?: string) {
  if (voiceId) return voiceId;
  if (!voiceName) throw new Error("Provide voice_id or voice_name");
  const data = (await elevenFetch(
    env,
    `/v2/voices?page_size=100&search=${encodeURIComponent(voiceName)}&include_total_count=false`,
  )) as { voices?: Array<{ voice_id: string; name: string }> };
  const exact = data.voices?.find((voice) => voice.name.toLowerCase() === voiceName.toLowerCase());
  if (!exact) {
    const candidates = data.voices?.map((v) => `${v.name} (${v.voice_id})`) ?? [];
    throw new Error(`Voice '${voiceName}' was not found. Matches: ${candidates.join(", ") || "none"}`);
  }
  return exact.voice_id;
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "Nicholas ElevenLabs Creative Bridge",
    version: "0.1.0",
  });

  server.registerTool(
    "bridge_status",
    {
      description: "Check that the Cloudflare ElevenLabs bridge is alive and configured.",
      inputSchema: {},
    },
    async () =>
      asText({
        ok: true,
        provider: "Cloudflare Workers",
        elevenlabs_key_configured: Boolean(env.ELEVENLABS_API_KEY),
        replit_required: false,
      }),
  );

  server.registerTool(
    "find_voices",
    {
      description: "Search the user's ElevenLabs voice library by name, description, or labels.",
      inputSchema: {
        search: z.string().default(""),
        page_size: z.number().int().min(1).max(100).default(30),
      },
    },
    async ({ search, page_size }) =>
      safe(() =>
        elevenFetch(
          env,
          `/v2/voices?page_size=${page_size}&search=${encodeURIComponent(search)}&include_total_count=false`,
        ),
      ),
  );

  server.registerTool(
    "create_speech",
    {
      description:
        "Start an asynchronous ElevenLabs speech generation. Use voice_name='August Nick' when requested, or supply a voice ID.",
      inputSchema: {
        text: z.string().min(1),
        voice_id: z.string().optional(),
        voice_name: z.string().optional(),
        model_id: z
          .enum(["eleven_v3", "eleven_multilingual_v2", "eleven_flash_v2_5"])
          .default("eleven_v3"),
        extra_json: z.string().optional().describe("Optional JSON object merged into the ElevenLabs request body."),
      },
    },
    async ({ text, voice_id, voice_name, model_id, extra_json }) =>
      safe(async () => {
        const voice = await resolveVoiceId(env, voice_id, voice_name);
        return elevenFetch(env, "/v1/flows/text-to-speech", {
          method: "POST",
          body: JSON.stringify({ ...parseExtra(extra_json), model_id, text, voice }),
        });
      }),
  );

  server.registerTool(
    "get_speech",
    {
      description: "Get the status and signed output URL for an ElevenLabs speech generation.",
      inputSchema: { generation_id: z.string().min(1) },
    },
    async ({ generation_id }) =>
      safe(() => elevenFetch(env, `/v1/flows/text-to-speech/${encodeURIComponent(generation_id)}`)),
  );

  server.registerTool(
    "create_image",
    {
      description:
        "Start an ElevenLabs image generation. Defaults to GPT Image 2. extra_json can carry model-specific controls such as aspect ratio, resolution, and references.",
      inputSchema: {
        prompt: z.string().min(1),
        model_id: z.string().default("gpt-image-2"),
        extra_json: z.string().optional().describe("Optional JSON object merged into the model request."),
      },
    },
    async ({ prompt, model_id, extra_json }) =>
      safe(() =>
        elevenFetch(env, "/v1/flows/image", {
          method: "POST",
          body: JSON.stringify({ ...parseExtra(extra_json), model_id, prompt }),
        }),
      ),
  );

  server.registerTool(
    "get_image",
    {
      description: "Get the status and signed output URL for an ElevenLabs image generation.",
      inputSchema: { generation_id: z.string().min(1) },
    },
    async ({ generation_id }) =>
      safe(() => elevenFetch(env, `/v1/flows/image/${encodeURIComponent(generation_id)}`)),
  );

  server.registerTool(
    "create_video",
    {
      description:
        "Start an ElevenLabs video generation. Defaults to Google Veo 3.1 Fast. A start frame may come from an ElevenLabs generation, asset, or inline base64 image.",
      inputSchema: {
        prompt: z.string().min(1),
        model_id: z.string().default("veo-3.1-fast-generate-001"),
        start_frame_generation_id: z.string().optional(),
        start_frame_asset_id: z.string().optional(),
        start_frame_base64: z.string().optional(),
        start_frame_mime_type: z.string().optional(),
        extra_json: z.string().optional().describe("Optional JSON object merged into the model request."),
      },
    },
    async ({
      prompt,
      model_id,
      start_frame_generation_id,
      start_frame_asset_id,
      start_frame_base64,
      start_frame_mime_type,
      extra_json,
    }) =>
      safe(() => {
        const startFrame = makeReference({
          generationId: start_frame_generation_id,
          assetId: start_frame_asset_id,
          base64: start_frame_base64,
          mimeType: start_frame_mime_type,
        });
        const body: JsonObject = { ...parseExtra(extra_json), model_id, prompt };
        if (startFrame) body.start_frame = startFrame;
        return elevenFetch(env, "/v1/flows/video", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }),
  );

  server.registerTool(
    "get_video",
    {
      description: "Get the status and signed output URL for an ElevenLabs video generation.",
      inputSchema: { generation_id: z.string().min(1) },
    },
    async ({ generation_id }) =>
      safe(() => elevenFetch(env, `/v1/flows/video/${encodeURIComponent(generation_id)}`)),
  );

  server.registerTool(
    "upload_asset_base64",
    {
      description:
        "Upload an image, audio, or video file to ElevenLabs Assets from base64. Useful for turning a ChatGPT-uploaded photo into an ElevenLabs video reference.",
      inputSchema: {
        name: z.string().min(1),
        mime_type: z.string().min(1),
        content_base64: z.string().min(1),
      },
    },
    async ({ name, mime_type, content_base64 }) =>
      safe(async () => {
        const cleaned = content_base64.includes(",") ? content_base64.split(",").pop()! : content_base64;
        const binary = atob(cleaned);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

        const form = new FormData();
        form.append("asset", new Blob([bytes], { type: mime_type }), name);
        form.append("name", name);

        return elevenFetch(env, "/v1/assets", { method: "POST", body: form });
      }),
  );

  server.registerTool(
    "create_lipsync_video",
    {
      description:
        "Create a talking/lip-sync video with Creatify Aurora from one image reference and one audio reference already stored or generated in ElevenLabs.",
      inputSchema: {
        image_generation_id: z.string().optional(),
        image_asset_id: z.string().optional(),
        audio_generation_id: z.string().optional(),
        audio_asset_id: z.string().optional(),
        extra_json: z.string().optional(),
      },
    },
    async ({
      image_generation_id,
      image_asset_id,
      audio_generation_id,
      audio_asset_id,
      extra_json,
    }) =>
      safe(() => {
        const image = makeReference({ generationId: image_generation_id, assetId: image_asset_id });
        const audio = makeReference({ generationId: audio_generation_id, assetId: audio_asset_id });
        if (!image) throw new Error("Provide image_generation_id or image_asset_id");
        if (!audio) throw new Error("Provide audio_generation_id or audio_asset_id");

        return elevenFetch(env, "/v1/flows/video", {
          method: "POST",
          body: JSON.stringify({
            ...parseExtra(extra_json),
            model_id: "creatify-aurora",
            image,
            audio,
          }),
        });
      }),
  );

  return server;
}

function isAuthorized(request: Request, env: Env) {
  if (!env.BRIDGE_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.BRIDGE_TOKEN}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "nicholas-elevenlabs-bridge", replit_required: false });
    }

    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });

    if (!isAuthorized(request, env)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      });
    }

    return createMcpHandler(() => createServer(env), {
      route: "/mcp",
      legacy: "stateless",
    })(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
