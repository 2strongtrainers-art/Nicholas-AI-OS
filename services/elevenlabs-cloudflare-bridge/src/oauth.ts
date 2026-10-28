/**
 * Stateless OAuth 2.0 for the Nicholas ElevenLabs Bridge.
 *
 * ChatGPT's custom-connector flow needs a real authorization-code flow, so
 * this module implements one without any database: every token is a
 * signed, expiring blob (HMAC-SHA256 over a base64url JSON payload).
 *
 * Secrets (all Cloudflare Worker secrets, never committed):
 * - OAUTH_SIGNING_SECRET: signs every issued token. Required for /oauth/*.
 * - CHATGPT_SETUP_CODE: one short code the owner types once in the browser
 *   approval page during ChatGPT's connect flow. Required for /oauth/*.
 * - OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET: optional. When set, the token
 *   endpoint enforces them; when unset, any client id is accepted so the
 *   ChatGPT connector can be configured without a pre-registered secret.
 *
 * The /mcp route accepts either the long-lived BRIDGE_TOKEN or a valid
 * OAuth access token issued here, so existing Bearer clients keep working.
 */

export interface OAuthEnv {
  OAUTH_SIGNING_SECRET?: string;
  CHATGPT_SETUP_CODE?: string;
  OAUTH_CLIENT_ID?: string;
  OAUTH_CLIENT_SECRET?: string;
}

type TokenKind = "code" | "access" | "refresh";

interface TokenPayload {
  kind: TokenKind;
  sub: string;
  client_id: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  exp: number;
  jti: string;
}

const CODE_TTL_SECONDS = 10 * 60;
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

// ChatGPT's connector redirect targets. Localhost is allowed only so the
// owner can test the flow from their own machine.
const ALLOWED_REDIRECT_HOSTS = ["chatgpt.com", "openai.com"];

function redirectHostAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") return false;
  if (url.hostname === "localhost") return true;
  return ALLOWED_REDIRECT_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signToken(secret: string, payload: TokenPayload): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(body),
  );
  return `${body}.${b64urlEncode(new Uint8Array(signature))}`;
}

async function verifyToken(secret: string, token: string): Promise<TokenPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(body),
  );
  const given = b64urlDecode(signature);
  const expectedBytes = new Uint8Array(expected);
  if (given.length !== expectedBytes.length) return null;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given[i] ^ expectedBytes[i];
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as TokenPayload;
    if (!payload.kind || !payload.exp || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function newPayload(
  kind: TokenKind,
  ttlSeconds: number,
  extra: Partial<TokenPayload> = {},
): TokenPayload {
  return {
    kind,
    sub: "nicholas-chatgpt",
    client_id: extra.client_id || "",
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    jti: crypto.randomUUID(),
    ...extra,
  };
}

/** True when `authorization` carries a live OAuth access token. */
export async function isOAuthAccessToken(
  env: OAuthEnv,
  authorization: string | null,
): Promise<boolean> {
  if (!env.OAUTH_SIGNING_SECRET || !authorization?.startsWith("Bearer ")) return false;
  const payload = await verifyToken(env.OAUTH_SIGNING_SECRET, authorization.slice("Bearer ".length));
  return payload?.kind === "access";
}

function oauthEnabled(env: OAuthEnv): boolean {
  return Boolean(env.OAUTH_SIGNING_SECRET && env.CHATGPT_SETUP_CODE);
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function authorizePage(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  error?: string;
}): string {
  const error = params.error
    ? `<p style="color:#b00020">${htmlEscape(params.error)}</p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Connect Nicholas ElevenLabs Bridge</title></head><body style="font-family:system-ui;max-width:520px;margin:48px auto;padding:0 16px">
<h1>Connect ChatGPT to the ElevenLabs Bridge?</h1>
<p>This grants ChatGPT access to Nicholas's ElevenLabs voice tools through this private bridge. No ElevenLabs key is shown here; it stays server-side.</p>
${error}
<form method="post" action="/oauth/authorize">
<input type="hidden" name="client_id" value="${htmlEscape(params.clientId)}">
<input type="hidden" name="redirect_uri" value="${htmlEscape(params.redirectUri)}">
<input type="hidden" name="state" value="${htmlEscape(params.state)}">
<input type="hidden" name="scope" value="${htmlEscape(params.scope)}">
<label>Owner setup code<br><input type="password" name="setup_code" required style="width:100%;padding:8px;margin-top:4px"></label><br><br>
<button type="submit" style="padding:10px 18px">Approve connection</button>
</form></body></html>`;
}

async function sha256B64url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return b64urlEncode(new Uint8Array(digest));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Handles every /oauth/* and /.well-known/oauth-* route. Returns null when
 * the request path is not an OAuth route.
 */
export async function handleOAuth(
  request: Request,
  env: OAuthEnv,
  origin: string,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return Response.json({
      resource: origin,
      authorization_servers: [origin],
      scopes_supported: ["elevenlabs"],
    });
  }

  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return Response.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    });
  }

  if (url.pathname === "/oauth/authorize" && request.method === "GET") {
    if (!oauthEnabled(env)) {
      return new Response("OAuth is not configured on this bridge", { status: 503 });
    }
    const clientId = url.searchParams.get("client_id") || "";
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const state = url.searchParams.get("state") || "";
    const scope = url.searchParams.get("scope") || "elevenlabs";
    if (url.searchParams.get("response_type") !== "code" || !clientId || !redirectHostAllowed(redirectUri)) {
      return new Response("Invalid authorization request", { status: 400 });
    }
    // PKCE parameters ride along inside the signed code token, so the
    // approval form only needs the fields ChatGPT must see echoed back.
    const form = authorizePage({ clientId, redirectUri, state, scope });
    return new Response(
      form.replace(
        "</form>",
        `<input type="hidden" name="code_challenge" value="${htmlEscape(url.searchParams.get("code_challenge") || "")}">
<input type="hidden" name="code_challenge_method" value="${htmlEscape(url.searchParams.get("code_challenge_method") || "plain")}">
</form>`,
      ),
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  if (url.pathname === "/oauth/authorize" && request.method === "POST") {
    if (!oauthEnabled(env)) {
      return new Response("OAuth is not configured on this bridge", { status: 503 });
    }
    const form = await request.formData();
    const clientId = String(form.get("client_id") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const state = String(form.get("state") || "");
    const setupCode = String(form.get("setup_code") || "");
    if (
      !clientId ||
      !redirectHostAllowed(redirectUri) ||
      !timingSafeEqual(setupCode, env.CHATGPT_SETUP_CODE || "")
    ) {
      return new Response(
        authorizePage({ clientId, redirectUri, state, scope: "elevenlabs", error: "Setup code did not match." }),
        { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    const code = await signToken(
      env.OAUTH_SIGNING_SECRET as string,
      newPayload("code", CODE_TTL_SECONDS, {
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: String(form.get("code_challenge") || "") || undefined,
        code_challenge_method: String(form.get("code_challenge_method") || "plain") || undefined,
      }),
    );
    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    return Response.redirect(target.toString(), 302);
  }

  if (url.pathname === "/oauth/token" && request.method === "POST") {
    if (!oauthEnabled(env)) {
      return Response.json({ error: "server_not_configured" }, { status: 503 });
    }
    const form = await request.formData();
    const grant = String(form.get("grant_type") || "");
    const clientId = String(form.get("client_id") || "");
    if (env.OAUTH_CLIENT_ID && clientId !== env.OAUTH_CLIENT_ID) {
      return Response.json({ error: "invalid_client" }, { status: 401 });
    }
    if (env.OAUTH_CLIENT_SECRET) {
      const secret = String(form.get("client_secret") || "");
      if (!timingSafeEqual(secret, env.OAUTH_CLIENT_SECRET)) {
        return Response.json({ error: "invalid_client" }, { status: 401 });
      }
    }
    const signing = env.OAUTH_SIGNING_SECRET as string;

    if (grant === "authorization_code") {
      const code = String(form.get("code") || "");
      const redirectUri = String(form.get("redirect_uri") || "");
      const payload = await verifyToken(signing, code);
      if (
        !payload ||
        payload.kind !== "code" ||
        payload.client_id !== clientId ||
        payload.redirect_uri !== redirectUri
      ) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      if (payload.code_challenge) {
        const verifier = String(form.get("code_verifier") || "");
        const expected =
          payload.code_challenge_method === "S256"
            ? await sha256B64url(verifier)
            : verifier;
        if (!verifier || expected !== payload.code_challenge) {
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        }
      }
      const access = await signToken(signing, newPayload("access", ACCESS_TTL_SECONDS, { client_id: clientId }));
      const refresh = await signToken(signing, newPayload("refresh", REFRESH_TTL_SECONDS, { client_id: clientId }));
      return Response.json({
        access_token: access,
        token_type: "Bearer",
        expires_in: ACCESS_TTL_SECONDS,
        refresh_token: refresh,
        scope: "elevenlabs",
      });
    }

    if (grant === "refresh_token") {
      const token = String(form.get("refresh_token") || "");
      const payload = await verifyToken(signing, token);
      if (!payload || payload.kind !== "refresh" || payload.client_id !== clientId) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      const access = await signToken(signing, newPayload("access", ACCESS_TTL_SECONDS, { client_id: clientId }));
      const refresh = await signToken(signing, newPayload("refresh", REFRESH_TTL_SECONDS, { client_id: clientId }));
      return Response.json({
        access_token: access,
        token_type: "Bearer",
        expires_in: ACCESS_TTL_SECONDS,
        refresh_token: refresh,
        scope: "elevenlabs",
      });
    }

    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  return null;
}
