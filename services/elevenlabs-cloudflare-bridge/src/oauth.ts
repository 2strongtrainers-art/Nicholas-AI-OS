/** Signed OAuth tokens with atomic, single-use redemption and refresh rotation. */
export interface OAuthEnv {
  OAUTH_SIGNING_SECRET?: string;
  CHATGPT_SETUP_CODE?: string;
  OAUTH_CLIENT_ID?: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_GRANTS?: DurableObjectNamespace;
}

type Kind = "code" | "access" | "refresh";
interface Payload {
  kind: Kind;
  iss: string;
  aud: string;
  client_id: string;
  exp: number;
  jti: string;
  grant_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
}
const ACCESS_TTL = 3600;
const GRANT_TTL = 30 * 86400;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const noStore = { "cache-control": "no-store", pragma: "no-cache" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

function encode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded + "=".repeat((4 - padded.length % 4) % 4)), (c) => c.charCodeAt(0));
}
const bytes = (s: string) => new TextEncoder().encode(s);
const key = (secret: string) => crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
async function sign(secret: string, payload: Payload): Promise<string> {
  const body = encode(bytes(JSON.stringify(payload)));
  return `${body}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), bytes(body))))}`;
}
async function verify(secret: string, token: string, origin: string): Promise<Payload | null> {
  // Include decoding and crypto in the guard: malformed bearer input must never throw.
  try {
    if (token.length > 8192) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    if (!await crypto.subtle.verify("HMAC", await key(secret), decode(signature), bytes(body))) return null;
    const p = JSON.parse(new TextDecoder().decode(decode(body))) as Payload;
    if (!p || !["code", "access", "refresh"].includes(p.kind) ||
        !Number.isSafeInteger(p.exp) || p.exp <= Math.floor(Date.now() / 1000) ||
        typeof p.jti !== "string" || !p.jti || typeof p.client_id !== "string" || !p.client_id ||
        p.iss !== origin || p.aud !== `${origin}/mcp`) return null;
    return p;
  } catch { return null; }
}
function payload(kind: Kind, origin: string, clientId: string, exp: number, extra: Partial<Payload> = {}): Payload {
  return { kind, iss: origin, aud: `${origin}/mcp`, client_id: clientId, exp, jti: crypto.randomUUID(), ...extra };
}
async function grantRequest(env: OAuthEnv, origin: string, id: string, action: string, data = {}): Promise<boolean> {
  if (!env.OAUTH_GRANTS) throw new Error("Grant storage unavailable");
  const object = env.OAUTH_GRANTS.get(env.OAUTH_GRANTS.idFromName(`${origin}:${id}`));
  const response = await object.fetch(`https://oauth-grant/${action}`, {
    method: "POST", body: JSON.stringify(data), signal: AbortSignal.timeout(5000),
  });
  if (response.status === 204) return true;
  if (response.status === 409) return false;
  throw new Error("Grant storage unavailable");
}
export function oauthEnabled(env: OAuthEnv): boolean {
  return Boolean(env.OAUTH_SIGNING_SECRET && env.CHATGPT_SETUP_CODE && env.OAUTH_GRANTS);
}
export async function isOAuthAccessToken(env: OAuthEnv, authorization: string | null, origin: string): Promise<boolean> {
  if (!env.OAUTH_SIGNING_SECRET || !authorization?.startsWith("Bearer ")) return false;
  const p = await verify(env.OAUTH_SIGNING_SECRET, authorization.slice(7), origin);
  if (p?.kind !== "access" || !p.grant_id) return false;
  try { return await grantRequest(env, origin, p.grant_id, "active"); }
  catch { return false; }
}
function redirectAllowed(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && !u.hash && !u.port &&
      ["chatgpt.com", "openai.com"].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch { return false; }
}
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function authorizationParams(input: URLSearchParams | FormData, env: OAuthEnv, origin: string): Record<string, string> | null {
  const p = Object.fromEntries(["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method", "resource"]
    .map((k) => [k, String(input.get(k) || (k === "scope" ? "elevenlabs" : ""))]));
  if (!p.client_id || p.client_id.length > 256 || (env.OAUTH_CLIENT_ID && p.client_id !== env.OAUTH_CLIENT_ID) ||
      !redirectAllowed(p.redirect_uri) || p.state.length > 2048 || p.scope !== "elevenlabs" ||
      !CHALLENGE.test(p.code_challenge) || p.code_challenge_method !== "S256" ||
      (p.resource && p.resource !== `${origin}/mcp`)) return null;
  return p;
}
function authorizePage(p: Record<string, string>, error = false): Response {
  const hidden = Object.entries(p).map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`).join("\n");
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Connect Nicholas ElevenLabs Bridge</title></head><body>
<h1>Connect ChatGPT to the ElevenLabs Bridge?</h1>
<p>This grants access to your ElevenLabs voice tools. Generation can consume ElevenLabs credits. Your API key stays on the server.</p>
${error ? "<p>Setup code did not match.</p>" : ""}
<form method="post" action="/oauth/authorize">${hidden}
<label>Owner setup code <input type="password" name="setup_code" required></label>
<button type="submit">Approve connection</button></form></body></html>`, {
    status: error ? 403 : 200,
    headers: { ...noStore, "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'" },
  });
}

export async function handleOAuth(request: Request, env: OAuthEnv, origin: string): Promise<Response | null> {
  const url = new URL(request.url);
  if (["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"].includes(url.pathname)) {
    return json({ resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: ["elevenlabs"] });
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return json({ issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`,
      response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [env.OAUTH_CLIENT_SECRET ? "client_secret_post" : "none"], scopes_supported: ["elevenlabs"] });
  }
  if (!["/oauth/authorize", "/oauth/token"].includes(url.pathname)) return null;
  if (!oauthEnabled(env)) return json({ error: "server_not_configured" }, 503);
  const signing = env.OAUTH_SIGNING_SECRET!;
  if (url.pathname === "/oauth/authorize") {
    if (!["GET", "POST"].includes(request.method)) return json({ error: "invalid_request" }, 405);
    let input: URLSearchParams | FormData;
    try { input = request.method === "GET" ? url.searchParams : await request.formData(); }
    catch { return json({ error: "invalid_request" }, 400); }
    if (request.method === "GET" && input.get("response_type") !== "code") return json({ error: "invalid_request" }, 400);
    const p = authorizationParams(input, env, origin);
    if (!p) return json({ error: "invalid_request" }, 400);
    if (request.method === "GET") return authorizePage(p);
    if (!equal(String(input.get("setup_code") || ""), env.CHATGPT_SETUP_CODE!)) return authorizePage(p, true);
    const code = await sign(signing, payload("code", origin, p.client_id, Math.floor(Date.now() / 1000) + 600,
      { redirect_uri: p.redirect_uri, code_challenge: p.code_challenge }));
    const target = new URL(p.redirect_uri);
    target.searchParams.set("code", code);
    if (p.state) target.searchParams.set("state", p.state);
    return new Response(null, { status: 302, headers: { ...noStore, location: target.toString() } });
  }
  if (request.method !== "POST") return json({ error: "invalid_request" }, 405);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "invalid_request" }, 400); }
  const grant = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  if (!clientId || (env.OAUTH_CLIENT_ID && clientId !== env.OAUTH_CLIENT_ID) ||
      (env.OAUTH_CLIENT_SECRET && !equal(String(form.get("client_secret") || ""), env.OAUTH_CLIENT_SECRET))) {
    return json({ error: "invalid_client" }, 401);
  }
  if (form.get("resource") && form.get("resource") !== `${origin}/mcp`) return json({ error: "invalid_target" }, 400);
  if (!["authorization_code", "refresh_token"].includes(grant)) return json({ error: "unsupported_grant_type" }, 400);
  const previous = await verify(signing, String(form.get(grant === "authorization_code" ? "code" : "refresh_token") || ""), origin);
  if (!previous || previous.client_id !== clientId || previous.kind !== (grant === "authorization_code" ? "code" : "refresh")) {
    return json({ error: "invalid_grant" }, 400);
  }
  if (grant === "authorization_code") {
    const verifier = String(form.get("code_verifier") || "");
    if (previous.redirect_uri !== form.get("redirect_uri") || !previous.code_challenge || !VERIFIER.test(verifier) ||
        encode(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(verifier)))) !== previous.code_challenge) {
      return json({ error: "invalid_grant" }, 400);
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const grantId = grant === "authorization_code" ? previous.jti : previous.grant_id;
  if (!grantId) return json({ error: "invalid_grant" }, 400);
  const expires = grant === "authorization_code" ? now + GRANT_TTL : previous.exp;
  const refresh = payload("refresh", origin, clientId, expires, { grant_id: grantId });
  try {
    const accepted = await grantRequest(env, origin, grantId, grant === "authorization_code" ? "consume" : "rotate",
      grant === "authorization_code" ? { expiresAt: expires * 1000, refreshId: refresh.jti } : { refreshId: previous.jti, nextRefreshId: refresh.jti });
    if (!accepted) return json({ error: "invalid_grant" }, 400);
    const accessExp = Math.min(now + ACCESS_TTL, expires);
    return json({ access_token: await sign(signing, payload("access", origin, clientId, accessExp, { grant_id: grantId })),
      token_type: "Bearer", expires_in: accessExp - now, refresh_token: await sign(signing, refresh), scope: "elevenlabs" });
  } catch { return json({ error: "temporarily_unavailable" }, 503); }
}
