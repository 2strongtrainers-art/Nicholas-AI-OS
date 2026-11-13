import { z } from "zod";

// Keep uploads comfortably below a Worker's request and memory limits. This is
// for short private review audio, not a server-side filesystem or URL proxy.
export const MAX_TRANSCRIPTION_BYTES = 10 * 1024 * 1024;
export const TRANSCRIPTION_TIMEOUT_MS = 60_000;
const MAX_BASE64_CHARACTERS = 4 * Math.ceil(MAX_TRANSCRIPTION_BYTES / 3);
const TRANSCRIPTION_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export interface TranscriptionEnv {
  ELEVENLABS_API_KEY?: string;
  ALLOW_PAID_AI?: string;
}

export const transcriptionInputSchema = {
  name: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .describe("Audio filename only, without a directory path."),
  mime_type: z.enum([
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4",
    "audio/x-m4a", "audio/aac", "audio/ogg", "audio/flac", "audio/x-flac", "audio/webm",
  ]),
  content_base64: z.string().min(4).max(MAX_BASE64_CHARACTERS)
    .describe("Raw standard base64 audio bytes, at most 10 MiB decoded. No data URI, URL, or local path."),
  model_id: z.enum(["scribe_v1", "scribe_v2"]).default("scribe_v2"),
  language_code: z.string().regex(/^[a-z]{2,3}$/).optional(),
  diarize: z.boolean().default(false),
};

const inputSchema = z.object(transcriptionInputSchema).strict();
export type TranscriptionInput = z.input<typeof inputSchema>;

function audioBytes(content: string): Uint8Array<ArrayBuffer> {
  if (content.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(content)) {
    throw new Error("content_base64 must contain raw standard base64 audio bytes");
  }
  let binary: string;
  try { binary = atob(content); } catch {
    throw new Error("content_base64 must contain raw standard base64 audio bytes");
  }
  if (btoa(binary) !== content) throw new Error("content_base64 is not canonical base64");
  if (!binary.length || binary.length > MAX_TRANSCRIPTION_BYTES) {
    throw new Error("Audio must contain between 1 byte and 10 MiB");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isTranscript(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (typeof result.text !== "string" || !Array.isArray(result.words)) return false;
  if (result.text.trim() && !result.words.some((item) => {
    if (!item || typeof item !== "object") return false;
    const word = item as Record<string, unknown>;
    return word.type === "word" && typeof word.text === "string" && word.text.trim().length > 0;
  })) return false;
  return result.words.every((item) => {
    if (!item || typeof item !== "object") return false;
    const word = item as Record<string, unknown>;
    return typeof word.text === "string" && typeof word.start === "number" &&
      Number.isFinite(word.start) && word.start >= 0 && typeof word.end === "number" &&
      Number.isFinite(word.end) && word.end >= word.start;
  });
}

export async function transcribeAudio(
  env: TranscriptionEnv,
  input: TranscriptionInput,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  if (env.ALLOW_PAID_AI?.trim().toLowerCase() !== "true") {
    throw new Error("Transcription requires explicit ALLOW_PAID_AI=true");
  }
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
  const args = inputSchema.parse(input);
  const bytes = audioBytes(args.content_base64);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: args.mime_type }), args.name);
  form.append("model_id", args.model_id);
  form.append("timestamps_granularity", "word");
  form.append("diarize", String(args.diarize));
  form.append("tag_audio_events", "false");
  if (args.language_code) form.append("language_code", args.language_code);

  let response: Response;
  try {
    response = await fetchImpl(TRANSCRIPTION_URL, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
      body: form,
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new Error("ElevenLabs transcription timed out after 60 seconds; no automatic retry was attempted");
    }
    throw new Error("ElevenLabs transcription request failed; no automatic retry was attempted");
  }
  if (!response.ok) {
    // Provider error bodies may echo private input. Never forward or log them.
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`ElevenLabs transcription failed (HTTP ${response.status}); no automatic retry was attempted`);
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("ElevenLabs transcription returned unreadable JSON; no automatic retry was attempted");
  }
  if (!isTranscript(result)) {
    throw new Error("ElevenLabs transcription did not return a transcript with valid word timestamps");
  }
  return { model_id: args.model_id, ...result };
}
